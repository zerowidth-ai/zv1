import fs from "fs";
import path from "path";
import Ajv from "ajv";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

import ErrorManager from "./classes/ErrorManager.js";

import { callMCPTool, fetchMCPToolSchema } from "./utilities/mcp.js";
import { loadNodes, loadIntegrations } from "./utilities/loaders.js";
import { validateKeys, validateFlow, validateInputs } from "./utilities/validators.js";
import { loadCustomTypes, typeCheck } from "./utilities/typers.js";
import { createSafeToolName, isRemoteMCPTool, isManualToolNode, mapTypeToJSONSchema, getDirname } from "./utilities/helpers.js";


/**
 * zv1 - Core class for executing node-based flows
 * Handles node loading, input/output validation, and flow execution
 */
export default class zv1 {



  /**
   * Create a new zv1 instance
   * @param {Object} flow - The flow definition containing nodes and links  
   * @param {Object} config - Configuration options and context for the engine
   */
  constructor(flow, config = {}) {
    this.flow = flow;

    this.debug = config.debug || false;
    this.keys = config.keys || {};

    this.maxPluginCalls = config.maxPluginCalls || 10;
    
    this.config = {
        ...config
    };

  }
    
  async initialize() {

    this.loadNodes = loadNodes.bind(this);
    this.loadIntegrations = loadIntegrations.bind(this);
    this.loadCustomTypes = loadCustomTypes.bind(this);
    
    this.typeCheck = typeCheck.bind(this);
    this.fetchMCPToolSchema = fetchMCPToolSchema.bind(this);
    this.validateKeys = validateKeys.bind(this);
    this.validateFlow = validateFlow.bind(this);
    this.validateInputs = validateInputs.bind(this);  


    const nodes = await this.loadNodes(this.flow);
    const compiledCustomTypes = await this.loadCustomTypes();

    if(!this.config.integrations) {
      this.config.integrations = await this.loadIntegrations(this.config);
    }

    this.nodes = nodes;
    this.compiledCustomTypes = compiledCustomTypes;
    this.nodesDir = path.join(getDirname(import.meta.url), "../nodes");
    

    this.cache = {};
    this.flowTimeout = null;
    this.timeline = [];

    // Initialize ErrorManager for centralized error handling
    this.errorManager = new ErrorManager({
      onError: this.config.onError || null,
      executionId: this.config.executionId || uuidv4(),
      executionContext: {
        timeline: this.timeline,
        nodeCount: this.flow.nodes.length
      }
    });

    // this.logDebug("zv1 initialized with config:", JSON.stringify(config, null, 2));
    this.logDebug(`Loaded ${Object.keys(nodes).length} node types`);
    this.logDebug(`Loaded ${Object.keys(compiledCustomTypes).length} custom types`);

    // Clean up the flow
    this.sanitizeFlow();

    // Validate keys for nodes
    this.validateKeys();

    // Ensure the flow can even be run
    this.validateFlow(this.flow);
    this.initializePluginMappings();
  }

  /**
   * Create a new zv1 instance
   * @param {Object} flow - The flow definition containing nodes and links  
   * @param {Object} config - Configuration options and context for the engine
   */
  static async create(flow, config = {}) {

    // if flow is a string, import it as a json file
    if(typeof flow === 'string') {
      flow = JSON.parse(fs.readFileSync(flow, 'utf8'));
    }
    
    const engine = new zv1(flow, config);

    // Initialize the engine
    await engine.initialize();
    return engine;
  }

  /**
   * Helper function to log debug information
   * @param {...any} args - Arguments to log
   */
  logDebug(...args) {
    if (this.debug) {
      console.log("[DEBUG]", ...args);
    }
  }

  /**
   * Update execution context for ErrorManager
   * @param {Object} context - Additional execution context
   */
  updateErrorContext(context) {
    if (this.errorManager) {
      this.errorManager.updateExecutionContext(context);
    }
  }

  /**
   * Core execution logic shared between processNode and processNodeWithArgs
   * @private
   */
  async _executeNodeCore(node, inputs, settings, nodeDefinition) {
    const timelineEntry = {
      nodeId: node.id,
      nodeType: node.type,
      inputs: JSON.parse(JSON.stringify(inputs)),
      settings: JSON.parse(JSON.stringify(settings || {})),
      startTime: new Date().toISOString()
    };
    const startDate = new Date();
    
    try {
      if(this.config.onNodeStart) {
        await this.config.onNodeStart({
          nodeId: node.id,
          nodeType: node.type,
          timestamp: Date.now(),
          inputs: inputs,
          settings: settings || {}
        });
      }

      // add type and id to nodeConfig
      nodeDefinition.config.type = node.type;
      nodeDefinition.config.id = node.id;

      const outputs = await nodeDefinition.process({inputs, settings, config: this.config, nodeConfig: nodeDefinition.config});
      const endDate = new Date();
      timelineEntry.outputs = JSON.parse(JSON.stringify(outputs));
      timelineEntry.endTime = endDate.toISOString();
      timelineEntry.durationMs = endDate - startDate;
      timelineEntry.status = 'success';
      this.timeline.push(timelineEntry);
      
      if(this.config.onNodeComplete) {
        await this.config.onNodeComplete({
          nodeId: node.id,
          nodeType: node.type,
          timestamp: Date.now(),
          inputs: inputs,
          outputs: outputs,
          settings: settings || {}
        });
      }
      
      return outputs;
    } catch (error) {
      const endDate = new Date();
      timelineEntry.endTime = endDate.toISOString();
      timelineEntry.durationMs = endDate - startDate;
      timelineEntry.status = 'error';
      timelineEntry.errorMessage = error.message;
      this.timeline.push(timelineEntry);
      
      // Update execution context for ErrorManager
      this.errorManager.updateExecutionContext({
        timeline: this.timeline,
        nodeCount: this.flow.nodes.length,
        nodesExecuted: this.timeline.length,
        cost_summary: this._getCostSummaryFromTimeline()
      });

      // Use ErrorManager to handle the error
      this.errorManager.throwNodeError(
        node.id,
        node.type,
        `Node execution failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * Process a single node
   * @param {Object} node - The node to process
   * @returns {Object} The outputs from the node
   */
  async processNode(node) {
    
    this.logDebug(`Processing node [${node.id}] of type [${node.type}]`);
    
    const nodeDefinition = this.nodes[node.type];
    if (!nodeDefinition) {
      this.logDebug(`Error: Node type "${node.type}" not found`);
      throw new Error(`Node type "${node.type}" not found.`);
    }
  
    // If this node is an LLM that accepts plugins, use the special handler
    if (nodeDefinition.config.accepts_plugins) {
      this.logDebug(`Node [${node.id}] is an LLM with plugin support. Using processLLMNode.`);
      return await this.processLLMNode(node);
    }
  
    // Apply default settings from node configuration
    if (!node.settings) {
      node.settings = {};
    }
    
    // Inherit default values for settings
    if (nodeDefinition.config.settings) {
      nodeDefinition.config.settings.forEach(settingDef => {
        if (settingDef.default !== undefined && (node.settings[settingDef.name] === undefined || node.settings[settingDef.name] === null || node.settings[settingDef.name] === '')) {
          this.logDebug(`Applying default value for setting [${settingDef.name}]: ${JSON.stringify(settingDef.default)}`);
          node.settings[settingDef.name] = settingDef.default;
        }
      });
    }
    
    // Collect inputs from the cache
    const inputs = {};
    this.logDebug(`Collecting inputs for node [${node.id}]`);
    
    // Get all links that connect to this node
    const nodeInputLinks = this.flow.links.filter((link) => link.to.node_id === node.id);
    
    // First, identify which input ports have connections
    const connectedInputs = new Set();
    nodeInputLinks.forEach(link => {
      connectedInputs.add(link.to.port_name);
    });
    
    // Process all connected inputs
    nodeInputLinks.forEach((link) => {
      this.logDebug(`Processing link from [${link.from.node_id}:${link.from.port_name}] to [${node.id}:${link.to.port_name}]`);
      
      const key = `${link.from.node_id}:${link.from.port_name}`;
      const inputName = link.to.port_name;
  
      const inputDef = nodeDefinition.config.inputs.find((i) => i.name === inputName);
      if (!inputDef) {
        this.logDebug(`Warning: No input definition found for port ${inputName}`);
        return;
      }

      this.logDebug(`Input definition for ${inputName}:`, inputDef);
      this.logDebug(`Checking cache for key: ${key}`, this.cache[key]);
  
      if (key in this.cache) {
        if (inputDef.allow_multiple) {
          // Initialize or reset the array for this run
          
          if(!inputs[inputName]) {
            inputs[inputName] = [];
          }
          
          // Get the value and validate its type
          const value = this.cache[key];
          const itemType = inputDef.type || "any";
          
          // Validate individual item type
          if (this.typeCheck(value, itemType)) {
              inputs[inputName].push(value);
          } else {
              this.logDebug(`Type mismatch for item in multiple-input [${inputName}]: Expected ${itemType}`);
          }
        } else {
          this.logDebug(`Setting value for input [${inputName}]`);
          inputs[inputName] = this.cache[key];
        }
      } else if (!inputDef.required && inputDef.default !== undefined) {
        // If optional and no link value, use the default
        inputs[inputName] = inputDef.default;
        this.logDebug(`Input [${inputName}] for node [${node.id}] using default value:`, inputDef.default);
      } else {
        this.logDebug(`Warning: No value found for input [${inputName}] and no default available`);
      }
    });
  
    // Now handle unconnected inputs with default values
    nodeDefinition.config.inputs.forEach((inputDef) => {
      const inputName = inputDef.name;
      
      // Skip inputs that already have values from connections
      if (connectedInputs.has(inputName) || inputs[inputName] !== undefined) {
        return;
      }
      
      // Apply default value for unconnected inputs if available
      if (inputDef.default !== undefined) {
        inputs[inputName] = inputDef.default;
        this.logDebug(`Applied default value for unconnected input [${inputName}]:`, inputDef.default);
      } else if (inputDef.required) {
        this.logDebug(`Warning: Required input [${inputName}] has no connection and no default value`);
      }
    });
  

  
    // Debug: Log inputs before processing
    this.logDebug(`Node [${node.id}] of type [${node.type}] inputs:`, JSON.stringify(inputs, null, 2));
  
    // Validate inputs against node configuration
    this.validateInputs(nodeDefinition.config, inputs);
  
    // Execute the process function using the shared core logic
    this.logDebug(`Executing process function for node [${node.id}]`);
    
    const outputs = await this._executeNodeCore(node, inputs, node.settings || {}, nodeDefinition);
    
    // Debug: Log outputs after processing
    this.logDebug(`Node [${node.id}] outputs:`, JSON.stringify(outputs, null, 2));
    
    // Handle updated settings
    if (outputs.__updated_settings) {
      node.settings = {
        ...node.settings,
        ...outputs.__updated_settings,
      };
      this.logDebug(`Node [${node.id}] updated settings:`, JSON.stringify(node.settings, null, 2));
      delete outputs.__updated_settings; // Remove from regular outputs
    }
    
    // Store outputs in the cache
    for (const [key, value] of Object.entries(outputs)) {
      const cacheKey = `${node.id}:${key}`;
      this.logDebug(`Storing output in cache: ${cacheKey}`, value);
      this.cache[cacheKey] = value;
    }
    
    this.logDebug(`Node [${node.id}] processing completed successfully`);
    return outputs;
  }
  
  /**
   * Propagate values through the graph
   * @param {string} nodeId - The ID of the node to start propagation from
   */
  async propagate(nodeId) {
    this.logDebug(`Starting propagation from node [${nodeId}]`);
    const visitedNodes = new Set();
  
    const processQueue = async (currentNodeId) => {
      this.logDebug(`Processing queue for node [${currentNodeId}]`);
      if (visitedNodes.has(currentNodeId)) return; // Avoid reprocessing nodes
      visitedNodes.add(currentNodeId);
  
      const currentNode = this.flow.nodes.find((node) => node.id === currentNodeId);
      if (!currentNode) {
        this.logDebug(`Error: Node with ID "${currentNodeId}" not found`);
        throw new Error(`Node with ID "${currentNodeId}" not found.`);
      }
  
      this.logDebug(`Processing downstream propagation for node [${currentNodeId}]`);
  
      // Find all downstream nodes connected to this node
      const downstreamLinks = this.flow.links.filter((link) => {

        if(link.from.node_id === currentNodeId) {

          // did this output from nodeId actually send a value that wasn't undefined or null?
          const cacheKey = `${currentNodeId}:${link.from.port_name}`;
          const value = this.cache[cacheKey];
          if(value === undefined || value === null) {
            return false;
          }

          return true;
        }

        return false;
      });
      const downstreamNodes = downstreamLinks.map((link) => {
        const node = this.flow.nodes.find((node) => node.id === link.to.node_id);


        return node;
      });

      this.logDebug(`Downstream nodes: ${downstreamNodes.map(n => n?.id).join(', ')}`);
  
      for (const downstreamNode of downstreamNodes) {
        if (!downstreamNode) continue;
  
        // Check if the downstream node is ready
        const isReady = this.flow.links
          .filter((link) => link.to.node_id === downstreamNode.id)
          .every((link) => {
            
            if(link.type === 'plugin') {
              return true;
            }

            const inputName = link.to.port_name;
            
            const inputDef = this.nodes[downstreamNode.type].config.inputs.find((i) => i.name === inputName);
  
            const key = `${link.from.node_id}:${link.from.port_name}`;
            this.logDebug(`Checking if input [${inputName}] is ready, cache key: ${key}`);
            
            const isValueReady = key in this.cache;
            
            this.logDebug(`Value ready: ${isValueReady}, required: ${inputDef.required}`);
  
            if (inputDef?.required) {
              return isValueReady; // Required inputs must have a value
            }
  
            // Optional inputs can have null
            return isValueReady || this.cache[key] === null;
          });
  
        if (isReady) {
          this.logDebug(`Node [${downstreamNode.id}] is ready. Processing...`);
          try {
            await this.processNode(downstreamNode);
            await processQueue(downstreamNode.id); // Propagate further downstream
          } catch (error) {
            this.logDebug(`Error during propagation at node [${downstreamNode.id}]:`, error.message);
            throw error;
          }
        } else {
          this.logDebug(`Node [${downstreamNode.id}] is not ready.`);
        }
      }
    };
  
    await processQueue(nodeId);
    this.logDebug(`Propagation from node [${nodeId}] completed`);
  }
  
  
  /**
   * Run the flow and return the final output of the flow
   * @param {Object} inputData - Data to inject into input nodes
   * @param {number} timeout - Maximum execution time in milliseconds
   * @returns {Object} The final output from output nodes
   */
  async run(inputData, timeout = 60000) {
    this.logDebug(`Starting flow execution with timeout: ${timeout}ms`);
    this.logDebug(`Input data:`, JSON.stringify(inputData, null, 2));
    
    // Set a timeout to prevent infinite execution
    this.flowTimeout = setTimeout(() => {
      this.logDebug("Flow execution timed out");
      throw new Error("Flow execution timed out.");
    }, timeout);

    let inputsMissingValues = [];

    try {
      this.logDebug("Starting flow execution...");
  
      // Step 1: Process all entry nodes (constant nodes without inputs)
      for (const node of this.entryNodes) {
        this.logDebug(`Processing entry node [${node.id}] of type [${node.type}]`);
        await this.processNode(node);
        await this.propagate(node.id);
      }

      // Step 2: Process input nodes (if any)
      if (this.inputNodes.length > 0) {

        const numberOfInputDataNodes = this.inputNodes.filter(node => node.type === "input-data").length;
        const numberOfInputChatNodes = this.inputNodes.filter(node => node.type === "input-chat").length;
        const numberOfInputPromptNodes = this.inputNodes.filter(node => node.type === "input-prompt").length;


        this.logDebug(`Found ${numberOfInputDataNodes} input-data nodes, ${numberOfInputChatNodes} input-chat nodes, ${numberOfInputPromptNodes} input-prompt nodes`);


        for(const inputNode of this.inputNodes) {
          this.logDebug(`Injecting inputData into input node [${inputNode.id}]:`, inputData);
          if(!inputNode.settings) {
            inputNode.settings = {};
          }
          
          if(inputNode.type === "input-data") {
            let variable_value = inputData[inputNode.settings.key || 'data'];

            if(variable_value === undefined) {
              variable_value = inputNode.settings.default_value;
            }

            if(variable_value !== undefined) {
              await this.processNode({ ...inputNode, settings: { ...inputNode.settings, ...{value: variable_value} } });
              await this.propagate(inputNode.id);
            } else {
              inputsMissingValues.push({
                id: inputNode.id,
                type: inputNode.type,
                key: inputNode.settings.key || 'data'
              });
            }
          } else if(inputNode.type === "input-chat") {

            let variable_value = inputData[inputNode.settings.key || 'chat'];

            if(variable_value !== undefined) {
              await this.processNode({ ...inputNode, settings: { ...inputNode.settings, ...{messages: variable_value} } });
              await this.propagate(inputNode.id);
            } else {
              inputsMissingValues.push({
                id: inputNode.id,
                type: inputNode.type,
                key: inputNode.settings.key || 'chat'
              });
            }

          } else if(inputNode.type === "input-prompt") {
            let variable_value = inputData[inputNode.settings.key || 'prompt'];

            if(variable_value !== undefined) {
              await this.processNode({ ...inputNode, settings: { ...inputNode.settings, ...{prompt: variable_value} } });
              await this.propagate(inputNode.id);
            } else {
              inputsMissingValues.push({
                id: inputNode.id,
                type: inputNode.type,
                key: inputNode.settings.key || 'prompt'
              });
            }
          } 
        }

      } else {
        this.logDebug("No input nodes found - flow will start from constant nodes");
      }

      // Step 3: Capture and return all output nodes' results
      const outputNodes = this.flow.nodes.filter(
        (node) => this.nodes[node.type]?.config?.is_output
      );

      this.logDebug("outputNodes", outputNodes);
      
      // If no output nodes found, return partial completion from terminal nodes
      if (outputNodes.length === 0) {
        this.logDebug("No output nodes found, returning partial completion from terminal nodes");
        
        // Find all nodes that don't have outgoing connections
        const nodesWithOutgoingLinks = new Set(
          this.flow.links.map(link => link.from.node_id)
        );
        
        const terminalNodes = this.flow.nodes.filter(
          node => !nodesWithOutgoingLinks.has(node.id)
        );

        this.logDebug(`Found ${terminalNodes.length} terminal nodes`);
        
        // Collect outputs from all terminal nodes
        const terminalOutputs = terminalNodes
          .map(node => {
            const nodeConfig = this.nodes[node.type]?.config;
            if (!nodeConfig) return null;
            const outputs = {};
            // For all outputs defined in config
            for (const output of nodeConfig.outputs) {
              const cacheKey = `${node.id}:${output.name}`;
              const value = this.cache[cacheKey];
              if (value === null || value === undefined) continue;
              outputs[output.name] = value;
            }

            // --- NEW: For import nodes, also include all cache keys that start with node.id + ':'
            if (node.type.startsWith('imported-')) {
              for (const cacheKey in this.cache) {
                if (cacheKey.startsWith(`${node.id}:`)) {
                  const outputName = cacheKey.slice(node.id.length + 1);
                  if (!(outputName in outputs)) {
                    outputs[outputName] = this.cache[cacheKey];
                  }
                }
              }
            }
            if (Object.keys(outputs).length === 0) return null;
            return {
              node_id: node.id,
              type: node.type,
              outputs
            };
          })
          .filter(Boolean); // Remove null entries

        return {
          partial: true,
          message:  inputsMissingValues.length > 0 ? "Completed with missing input values and output nodes, results may be partial." : "Completed without output nodes.",
          terminalNodes: terminalOutputs,
          timeline: this.timeline,
          inputsMissingValues: inputsMissingValues,
          cost_summary: this._getCostSummaryFromTimeline()
        };
      }
      
      // Collect all outputs
      const finalOutputs = {};
      
      for (const node of outputNodes) {
        // Get the node's output values
        const nodeConfig = this.nodes[node.type].config;
        const nodeOutputs = nodeConfig.outputs;
        
        // check cache to see if this node returned a value for output_key

        const outputKey = node.settings.key;
        
        let doesThisNodeHaveAKey = false;
        
        if(outputKey !== undefined && outputKey !== null && outputKey !== '') {
          doesThisNodeHaveAKey = true;
        } else {
          doesThisNodeHaveAKey = false;
        }

        this.logDebug("nodeOutputs", nodeOutputs);

        const numberOfOutputDataNodes = nodeOutputs.filter(output => output.name === "value").length;
        const numberOfOutputChatNodes = nodeOutputs.filter(output => output.name === "chat").length;
        const numberOfOutputPromptNodes = nodeOutputs.filter(output => output.name === "prompt").length;

        this.logDebug(`Found ${numberOfOutputDataNodes} output-data nodes, ${numberOfOutputChatNodes} output-chat nodes, ${numberOfOutputPromptNodes} output-prompt nodes`);

        let dataIndex = 0;
        let chatIndex = 0;
        
        for (const output of nodeOutputs) {
          
          const cacheKey = `${node.id}:${output.name}`;

          if (cacheKey in this.cache) {
            const value = this.cache[cacheKey];
            
            // Skip null/undefined values
            if (value === null || value === undefined) continue;

            // if this node.type is a data output, add the value to .data if no key is provided - otherwise add the value to the outputs with the key
            if(node.type === "output-data") {
              if(doesThisNodeHaveAKey ) {
                // if the key is provided, add the value to the outputs with the key
                finalOutputs[outputKey] = value;
              } else if(numberOfOutputDataNodes > 1) {
                finalOutputs['data_' + dataIndex] = value;
                dataIndex++;
              } else {
                finalOutputs['data'] = value;
              }
            } else if(node.type === "output-chat") {
              // if this node.type is a chat output, add the value to the conversation object
              
              if(doesThisNodeHaveAKey) {
                finalOutputs[outputKey] = value;
              } else if(numberOfOutputChatNodes > 1) {
                finalOutputs['chat_' + chatIndex] = value;
                chatIndex++;
              } else {
                finalOutputs['chat'] = value;
              }
            }
          }
        }
      }
      
      this.logDebug("Flow execution complete. Final outputs:", finalOutputs);
      clearTimeout(this.flowTimeout);

      return {
        outputs: finalOutputs,
        timeline: this.timeline,
        cost_summary: this._getCostSummaryFromTimeline(),
        inputsMissingValues: inputsMissingValues,
        message:  inputsMissingValues.length > 0 ? "Completed with missing input values, results may be partial." : "Completed."
      };
    } finally {
      clearTimeout(this.flowTimeout);
    }
  }
  
  /**
   * Clean up the flow by removing invalid links
   * @private
   */
  sanitizeFlow() {
    const nodeIds = new Set(this.flow.nodes.map(node => node.id));
    
    // Filter out links that reference non-existent nodes
    const originalLength = this.flow.links.length;
    this.flow.links = this.flow.links.filter(link => 
      nodeIds.has(link.from.node_id) && nodeIds.has(link.to.node_id)
    );
    
    const removedCount = originalLength - this.flow.links.length;
    if (removedCount > 0) {
      this.logDebug(`Removed ${removedCount} invalid link(s) referencing non-existent nodes`);
    }
  }


  /**
   * Scan for plugin links and map LLM nodes to their plugin/tool nodes
   */
  initializePluginMappings() {
    this.llmPlugins = {};
    for (const node of this.flow.nodes) {
      if (this.nodes[node.type]?.config?.accepts_plugins) {
        this.llmPlugins[node.id] = this.flow.links
          .filter(link => link.type === "plugin" && link.to.node_id === node.id)
          .map(link => link.from.node_id);
      }
    }
  }

  /**
   * Main entry for processing LLM nodes with plugins/tools
   */
  async processLLMNode(node) {
    this.logDebug(`Processing LLM node [${node.id}] of type [${node.type}]`);
    
    const nodeDefinition = this.nodes[node.type];
    if (!nodeDefinition) {
      this.logDebug(`Error: Node type "${node.type}" not found`);
      throw new Error(`Node type "${node.type}" not found.`);
    }

    // Apply default settings from node configuration (same as processNode)
    if (!node.settings) {
      node.settings = {};
    }
    
    // Inherit default values for settings
    if (nodeDefinition.config.settings) {
      nodeDefinition.config.settings.forEach(settingDef => {
        if (settingDef.default !== undefined && (node.settings[settingDef.name] === undefined || node.settings[settingDef.name] === null || node.settings[settingDef.name] === '')) {
          this.logDebug(`Applying default value for setting [${settingDef.name}]: ${JSON.stringify(settingDef.default)}`);
          node.settings[settingDef.name] = settingDef.default;
        }
      });
    }
    
    // Collect inputs using the same logic as processNode (same as processNode)
    const inputs = {};
    this.logDebug(`Collecting inputs for LLM node [${node.id}]`);
    
    // Get all links that connect to this node
    const nodeInputLinks = this.flow.links.filter((link) => link.to.node_id === node.id);
    
    // First, identify which input ports have connections
    const connectedInputs = new Set();
    nodeInputLinks.forEach(link => {
      connectedInputs.add(link.to.port_name);
    });
    
    // Process all connected inputs
    nodeInputLinks.forEach((link) => {
      this.logDebug(`Processing link from [${link.from.node_id}:${link.from.port_name}] to [${node.id}:${link.to.port_name}]`);
      
      const key = `${link.from.node_id}:${link.from.port_name}`;
      const inputName = link.to.port_name;
  
      const inputDef = nodeDefinition.config.inputs.find((i) => i.name === inputName);
      if (!inputDef) {
        this.logDebug(`Warning: No input definition found for port ${inputName}`);
        return;
      }

      this.logDebug(`Input definition for ${inputName}:`, inputDef);
      this.logDebug(`Checking cache for key: ${key}`, this.cache[key]);
  
      if (key in this.cache) {
        if (inputDef.allow_multiple) {
          // Initialize or reset the array for this run
          
          if(!inputs[inputName]) {
            inputs[inputName] = [];
          }
          
          // Get the value and validate its type
          const value = this.cache[key];
          const itemType = inputDef.type || "any";
          
          // Validate individual item type
          if (this.typeCheck(value, itemType)) {
              inputs[inputName].push(value);
          } else {
              this.logDebug(`Type mismatch for item in multiple-input [${inputName}]: Expected ${itemType}`);
          }
        } else {
          this.logDebug(`Setting value for input [${inputName}]`);
          inputs[inputName] = this.cache[key];
        }
      } else if (!inputDef.required && inputDef.default !== undefined) {
        // If optional and no link value, use the default
        inputs[inputName] = inputDef.default;
        this.logDebug(`Input [${inputName}] for node [${node.id}] using default value:`, inputDef.default);
      } else {
        this.logDebug(`Warning: No value found for input [${inputName}] and no default available`);
      }
    });
  
    // Now handle unconnected inputs with default values
    nodeDefinition.config.inputs.forEach((inputDef) => {
      const inputName = inputDef.name;
      
      // Skip inputs that already have values from connections
      if (connectedInputs.has(inputName) || inputs[inputName] !== undefined) {
        return;
      }
      
      // Apply default value for unconnected inputs if available
      if (inputDef.default !== undefined) {
        inputs[inputName] = inputDef.default;
        this.logDebug(`Applied default value for unconnected input [${inputName}]:`, inputDef.default);
      } else if (inputDef.required) {
        this.logDebug(`Warning: Required input [${inputName}] has no connection and no default value`);
      }
    });

    // Debug: Log inputs before processing
    this.logDebug(`LLM Node [${node.id}] of type [${node.type}] inputs:`, JSON.stringify(inputs, null, 2));
  
    // Validate inputs against node configuration (same as processNode)
    this.validateInputs(nodeDefinition.config, inputs);

    // 1. Gather plugin/tool schemas and runners
    const pluginNodeIds = this.llmPlugins[node.id] || [];
    const toolSchemas = [];
    const toolRunners = {}; // toolName -> handler

    for (const pluginNodeId of pluginNodeIds) {
      const pluginNode = this.flow.nodes.find(n => n.id === pluginNodeId);
      if (!pluginNode) continue;

      if (this.isLocalNodePlugin(pluginNode)) {
        
        const schema = this.generateToolSchema(pluginNode);
        toolSchemas.push(schema);
        toolRunners[schema.name] = async (args) => {
          // When the LLM calls the tool, process the node with the provided args
          return await this.processNodeWithArgs(pluginNode, args);
        };
      } else if (isRemoteMCPTool(pluginNode)) {
        // Fetch all tools from the MCP endpoint
        const url = pluginNode.settings?.url;
        if (!url) continue; 
        const id = uuidv4();
        try {
          
          const response = await axios.post(url, {
            id,
            method: "tools/list",
            params: {}
          });
          const tools = response.data?.result?.tools || [];
          for (const tool of tools) {
            // Add each tool as a separate schema
            toolSchemas.push({
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            });
            // Map tool name to a runner that calls this MCP node/tool
            toolRunners[tool.name] = async (args) => {
              return await callMCPTool(pluginNode, { ...args, name: tool.name });
            };
          }
        } catch (err) {
          this.logDebug(`Failed to fetch MCP tools from ${url}: ${err.message}`);
        }
      } else if (isManualToolNode(pluginNode)) {
        const schema = this.generateToolSchema(pluginNode);
        toolSchemas.push(schema);
        // Manual tools: no runner, just pass through
      }
    }

    // --- Also gather manual tool nodes connected to the LLM's 'tools' input port ---
    const toolInputLinks = this.flow.links.filter(
      link => link.to.node_id === node.id && link.to.port_name === "tools"
    );
    for (const link of toolInputLinks) {
      // the schema should be grabbable from the node's output cache on its "tool" output
      const toolSchema = this.cache[`${link.from.node_id}:tool`];
      if(toolSchema) {
        toolSchemas.push(toolSchema);
      }
    }
    

    // 2. Inject toolSchemas into LLM call
    let llmResult;
    let tool_results = [];
    let toolCallMessage = null;
    let toolCallCount = 0;

    do {
      llmResult = await this.callLLMWithTools(node, inputs, toolSchemas, toolCallMessage, tool_results);
      tool_results = [];
      toolCallMessage = null;

      if (llmResult.tool_calls && llmResult.tool_calls.length > 0) {
        
        for (const tool_call of llmResult.tool_calls) {

          if(tool_call.type === 'function'){
            if (toolRunners[tool_call.function.name]) {

              // try to parse the arguments as a JSON object
              let toolArguments = tool_call.function.arguments;
              try {
                toolArguments = JSON.parse(tool_call.function.arguments);

                const toolResult = await toolRunners[tool_call.function.name](toolArguments);
                tool_results.push({
                  original_tool_call: tool_call,
                  tool_call_id: tool_call.id,
                  name: tool_call.function.name,
                  result: toolResult
                });
              } catch (e) {
                console.error('Failed to parse tool arguments as JSON', e);
              }
            } else {
              console.error('No runner found for tool', tool_call.name);
            }
          }
        }
        // Prepare the tool call message for the next LLM call
        toolCallMessage = {
          role: "assistant",
          content: null,
          tool_calls: llmResult.tool_calls
        };
        toolCallCount++;
      } else {
        break; // No more tool calls, exit loop
      }
    } while (tool_results.length > 0 && toolCallCount < this.maxPluginCalls);

    // 4. Continue with normal LLM output processing
    // Store outputs in the cache and propagate downstream
    for (const output of nodeDefinition.config.outputs || []) {
      const cacheKey = `${node.id}:${output.name}`;
      if (llmResult[output.name] !== undefined) {
        this.cache[cacheKey] = llmResult[output.name];
      }
    }
    
    // Debug: Log outputs after processing
    this.logDebug(`LLM Node [${node.id}] outputs:`, JSON.stringify(llmResult, null, 2));
    
    // Handle updated settings
    if (llmResult.__updated_settings) {
      node.settings = {
        ...node.settings,
        ...llmResult.__updated_settings,
      };
      this.logDebug(`LLM Node [${node.id}] updated settings:`, JSON.stringify(node.settings, null, 2));
      delete llmResult.__updated_settings; // Remove from regular outputs
    }
    
    this.logDebug(`LLM Node [${node.id}] processing completed successfully`);
    return llmResult;
  }

  isLocalNodePlugin(node) {
    const thisNodeConfig = this.nodes[node.type]?.config || {};
    return thisNodeConfig.is_plugin
  }

  isNodeReady(node) {
    const nodeDefinition = this.nodes[node.type];
    if (!nodeDefinition) throw new Error(`Node type "${node.type}" not found.`);
    for (const inputDef of nodeDefinition.config.inputs || []) {
      if (!inputDef.required) continue;
      const inputName = inputDef.name;
      const incomingLink = this.flow.links.find(
        link => link.to.node_id === node.id && link.to.port_name === inputName
      );
      if (incomingLink) {
        const cacheKey = `${incomingLink.from.node_id}:${incomingLink.from.port_name}`;
        if (!(cacheKey in this.cache)) {
          return false;
        }
      }
    }
    return true;
  }

  generateToolSchema(node) {
    // Get the node config and settings
    const config = this.nodes[node.type]?.config || {};
    const settings = node.settings || {};

    // Use the node's settings for name/description if present, otherwise fall back to config
    let name = settings.name || config.display_name || node.type;
    name = createSafeToolName(name);

    const description = settings.description || config.description || "";

    // Build JSON Schema properties for each input
    const properties = {};
    const required = [];
    (config.inputs || []).forEach(input => {
      properties[input.name] = {
        type: mapTypeToJSONSchema(input.type),
        description: input.description || "",
      };
      if (input.default !== undefined) {
        properties[input.name].default = input.default;
      }
      if (input.required) {
        required.push(input.name);
      }
    });

    // Return the tool schema object
    return {
      name,
      description,
      parameters: {
        type: "object",
        properties,
        required,
      }
    };
  }


  async processNodeWithArgs(node, args) {
    this.logDebug('processNodeWithArgs', node, args);

    const nodeDefinition = this.nodes[node.type];
    if (!nodeDefinition) throw new Error(`Node type "${node.type}" not found.`);

    // For import nodes, their process function expects (inputs, settings, config)
    // For regular nodes, same signature
    // We'll use node.settings or an empty object
    const settings = node.settings || {};
    
    // Execute using the shared core logic
    const outputs = await this._executeNodeCore(node, args, settings, nodeDefinition);

    this.logDebug('processNodeWithArgs outputs', outputs);
    return outputs;
  }


  async callLLMWithTools(node, inputs, toolSchemas, toolCallMessage, toolResults) {
    const nodeDefinition = this.nodes[node.type];
    if (!nodeDefinition) throw new Error(`Node type "${node.type}" not found.`);

    // Use the inputs passed from processLLMNode instead of re-collecting them
    const llmInputs = { ...inputs };
    
    // Inject the tools array
    llmInputs.tools = toolSchemas;

    // If this is a tool call response, append it to the messages array (OpenAI style)
    if (toolCallMessage && toolResults && Array.isArray(llmInputs.messages)) {

      // 
      llmInputs.messages = [
        ...llmInputs.messages,
        toolCallMessage
      ];

      for(const toolResult of toolResults) {
        // You may need to adapt this for other LLMs
          llmInputs.messages = [
            ...llmInputs.messages,
            {
              role: "tool",
              tool_call_id: toolResult.tool_call_id,
              name: toolResult.name,
              content: typeof toolResult.result === "string"
                ? toolResult.result
                : JSON.stringify(toolResult.result)
            }
          ];
      }
    }

    // Execute using the shared core logic
    const outputs = await this._executeNodeCore(node, llmInputs, node.settings || {}, nodeDefinition);

    return outputs;
  }

  _getCostSummaryFromTimeline() {
    let total = 0;
    let itemized = [];
    for (const entry of this.timeline) {
      const outputs = entry.outputs || {};
      if (typeof outputs.cost_total === 'number') {
        total += outputs.cost_total;

        let item = {
          node_id: entry.nodeId,
          node_type: entry.nodeType,
          total: outputs.cost_total,
          itemized: outputs.cost_itemized
        }
        itemized.push(item);
      }
    }
    
    return { 
      total, 
      itemized
    };
  }
}
