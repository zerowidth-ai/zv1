import path from "path";
import fs from "fs";
import Ajv from "ajv";
import zv1 from "../index.js";

import { getDirname } from "./helpers.js";

const ajv = new Ajv();

/**
 * Load custom type configurations from ./types/<type>.json
 * @returns {Promise<Object>} Map of type names to compiled validators
 */
export async function loadCustomTypes() {
  const retval = {};
  
  const typeDir = path.join(getDirname(import.meta.url), "../types");


  if (fs.existsSync(typeDir)) {
    const typeFiles = fs.readdirSync(typeDir);

    await Promise.all(typeFiles.map(async (typeFile) => {
      const typePath = path.join(typeDir, typeFile);
      const typeName = typeFile.replace(/\.json$/, "");

      try {
        const type = await import(typePath, { with: { type: "json" } });

        // For each custom type, compile the schema
        retval[typeName] = ajv.compile(type);

      } catch (err) { 
        console.error(err);
      }
    }));
  } else {
    throw new Error("No types directory found, skipping custom type loading");
  }

  return retval;
}


/**
 * Check if a value matches a given type
 * Handles basic types, custom types, and type unions
 * @param {any} value - The value to check
 * @param {string} type - The expected type
 * @returns {boolean} Whether the value matches the type
 */
export function typeCheck(value, type) {
  this.logDebug(`Type checking value against type '${type}'`, value);
  
  if (value === null) {
    this.logDebug("Null value passes type check");
    return true;
  }
  
  type = type.toLowerCase().trim();

  if (type === "any") {
    this.logDebug("'any' type always passes");
    return true;
  }

  if (type.includes(" or ")) {
    const typeOptions = type.split(" or ");
    this.logDebug(`Union type with options: ${typeOptions.join(', ')}`);
    return typeOptions.some((t) => this.typeCheck(value, t.trim()));
  }

  if (type === "number" && typeof value === "string") {
    const isNumeric = !isNaN(value);
    this.logDebug(`String to number conversion check: ${isNumeric ? "passed" : "failed"}`);
    return isNumeric;
  }

  if (type === "array") {
    const isArray = Array.isArray(value);
    this.logDebug(`Array type check: ${isArray ? "passed" : "failed"}`);
    return isArray;
  }

  if (type.startsWith("array of ")) {
    if (!Array.isArray(value)) {
      this.logDebug("Failed array check for 'array of' type");
      return false;
    }
    
    const itemType = type.slice(9).replace(/s$/, "");
    this.logDebug(`Checking each item in array against type: ${itemType}`);
    return value.every((item, index) => {
      const itemResult = this.typeCheck(item, itemType);
      if (!itemResult) {
        this.logDebug(`Item at index ${index} failed type check`);
      }
      return itemResult;
    });
  }

  if (this.compiledCustomTypes[type]) {
    const customTypeResult = this.compiledCustomTypes[type](value);
    this.logDebug(`Custom type '${type}' validation: ${customTypeResult ? "passed" : "failed"}`);
    return customTypeResult;
  }

  const typeResult = typeof value === type;
  this.logDebug(`Basic type check (${typeof value} === ${type}): ${typeResult ? "passed" : "failed"}`);
  return typeResult;
}


/**
 * Convert an import definition into a node type configuration
 * @private
 */
export function convertImportToNodeType(importDef) {
  this.logDebug(`Converting import ${importDef.id} to node type`);

  // First ensure any nested imports are processed
  let processedImportDef = { ...importDef };
  if (importDef.imports && importDef.imports.length > 0) {
    this.logDebug(`Processing ${importDef.imports.length} nested imports`);
    
    // Load nested imports as node types
    const nestedNodes = [];
    for (const nestedImport of importDef.imports) {
      const nodeType = this.convertImportToNodeType(nestedImport);
      nestedNodes.push(nodeType);
    }

    // Add the nested import nodes to the flow
    processedImportDef.nodes = [...processedImportDef.nodes, ...nestedNodes];
  }

  // Rest of the existing code...
  const inputNodes = processedImportDef.nodes.filter(node => 
    node.type === 'input-chat' || 
    node.type === 'input-prompt' || 
    node.type === 'input-data'
  );
  
  const outputNodes = processedImportDef.nodes.filter(node => 
    node.type === 'output-chat' || 
    node.type === 'output-data'
  );

  this.logDebug(`Found ${inputNodes.length} input nodes and ${outputNodes.length} output nodes`);

  return {
    config: {
      display_name: processedImportDef.display_name || "Imported Flow",
      description: processedImportDef.description || "An imported flow",
      category: "imported",
      is_constant: true, // All imports are potentially constant
      is_plugin: true,   // <-- Add this line to mark all imports as plugin-capable
      is_import: true,
      accepts_plugins: processedImportDef.nodes.some(node => node.type === 'input-plugins'),
      inputs: inputNodes.map(node => {
        
        if (node.type === 'input-data') {
          return {
            name: node.id,
            display_name: `Data: ${node.settings?.key || 'value'}`,
            type: node.settings?.type || 'any',
            required: true,
            is_data_input: true,
            description: node.settings?.description || 'Imported data input'
          };
        } else if (node.type === 'input-chat') {
          return {
            name: node.id,
            display_name: 'Chat',
            type: 'array of messages',
            required: true,
            is_chat_input: true,
            description: 'Chat messages to process'
          };
        } else { // input-prompt
          return {
            name: node.id,
            display_name: 'Prompt',
            type: 'string',
            required: true,
            is_prompt_input: true,
            description: 'Prompt input'
          };
        }
      }),

      outputs: outputNodes.map(node => {
        if (node.type === 'output-data') {
          return {
            name: node.id,
            display_name: `Data: ${node.settings?.key || 'value'}`,
            type: node.settings?.type || 'any',
            description: node.settings?.description || 'Imported data output'
          };
        } else { // output-chat
          return {
            name: node.id,
            display_name: 'Response',
            type: 'message',
            description: 'Chat response output'
          };
        }
      }),

      // Store the full import definition for use during processing
      importDefinition: processedImportDef
    },

    // All imports share this process function
    process: async ({inputs, settings, config, nodeConfig}) => {
      this.logDebug(`Processing import node with inputs:`, inputs);
      
      const timelineEntry = {
        nodeId: processedImportDef.id,
        nodeType: 'import',
        inputs: JSON.parse(JSON.stringify(inputs)),
        settings: JSON.parse(JSON.stringify(settings)),
        startTime: new Date().toISOString()
      };
      const startDate = new Date();

      // Create a new engine instance with the processed import definition
      const importEngine = await zv1.create(processedImportDef, config);

      // Prepare input data object based on the type of inputs
      const inputData = {
        // data: {},    // for input-data nodes
        // chat: {}, // for input-chat nodes
        // prompt: {}  // for input-prompt nodes
      };

      // Map outer inputs to inner input nodes
      for (const [inputId, value] of Object.entries(inputs)) {
        const inputNode = processedImportDef.nodes.find(n => n.id === inputId);
        if (!inputNode) continue;

        if (inputNode.type === 'input-data') {
          inputData[inputNode.settings?.key || 'data'] = value;
        } else if (inputNode.type === 'input-chat') {
          inputData[inputNode.settings?.key || 'chat'] = value;
        } else if (inputNode.type === 'input-prompt') {
          inputData[inputNode.settings?.key || 'prompt'] = value;
        }
      }

      // Run the imported flow
      const result = await importEngine.run(inputData);
      const endDate = new Date();
      timelineEntry.outputs = JSON.parse(JSON.stringify(result));
      timelineEntry.endTime = endDate.toISOString();
      timelineEntry.durationMs = endDate - startDate;
      this.timeline.push(timelineEntry);
      this.logDebug(`Import node execution result:`, result);

      // Map outputs back to the outer flow's format
      
      const outputs = {};
      outputNodes.forEach(node => {
        if (node.type === 'output-data') {
          if(node.settings?.key) {
            outputs[node.id] = result.outputs[node.settings?.key];
          } else {
            outputs[node.id] = result.outputs.data
          }
        } else if (node.type === 'output-chat') {
          if(node.settings?.key) {
            outputs[node.id] = result.outputs[node.settings?.key];
          } else {
            outputs[node.id] = result.outputs.chat;
          }
        }
      });


      // --- Add outputs for all terminal nodes in the imported flow ---
      const nodesWithOutgoingLinks = new Set(processedImportDef.links.map(link => link.from.node_id));
      const terminalNodes = processedImportDef.nodes.filter(node => !nodesWithOutgoingLinks.has(node.id));
      for (const terminalNode of terminalNodes) {
        if (terminalNode.type === 'output-data' || terminalNode.type === 'output-chat') continue;
        // Look up config for this node type
        const nodeConfig = this.nodes[terminalNode.type]?.config;
        if (!nodeConfig || !Array.isArray(nodeConfig.outputs)) continue;
        for (const output of nodeConfig.outputs) {
          const key = `${terminalNode.id}_${output.name}`;
          const cacheKey = `${terminalNode.id}:${output.name}`;
          const value = importEngine.cache[cacheKey];
          if (value !== undefined) {
            outputs[key] = value;
          }
        }
      }

      return outputs;
    }
  };
}