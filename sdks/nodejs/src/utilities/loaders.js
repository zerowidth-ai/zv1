import path from "path";
import fs from "fs";

import { convertImportToNodeType } from "./typers.js";
import { getDirname } from "./helpers.js";


/**
 * Load node configurations and processes
 * @returns {Object} Map of node types to their definitions
 */
export async function loadNodes(flow) {

  this.convertImportToNodeType = convertImportToNodeType.bind(this);

  // create a new flattened array of node types used in this flow and in any imports
  const nodeTypes = new Set();

  const findNodeTypes = (flow) => {
    flow.nodes.forEach(node => {
      nodeTypes.add(node.type);
    });
    if (flow.imports) {
      flow.imports.forEach(findNodeTypes);
    }
  }

  findNodeTypes(flow);

  const nodes = {};

  // Load regular nodes from filesystem
  const nodeLoadPromises = Array.from(nodeTypes).map(async (type) => {
    console.log('type', type);
    if(type.startsWith('imported-')) {
      return;
    }

    const nodePath = path.join(getDirname(import.meta.url), "../../nodes", type);
    const configPath = path.join(nodePath, `${type}.config.json`);
    const processPath = path.join(nodePath, `${type}.process.js`);

    if (fs.existsSync(configPath) && fs.existsSync(processPath)) {
      try {
        // Convert paths to file:// URLs for dynamic imports
        const configFileUrl = `file://${path.resolve(configPath)}`;
        const processFileUrl = `file://${path.resolve(processPath)}`;
        
        const [configModule, processModule] = await Promise.all([
          import(configFileUrl, { with: { type: "json" } }),
          import(processFileUrl)
        ]);
        
        nodes[type] = {
          config: configModule.default,
          process: processModule.default || processModule,
        };
      } catch (error) {
        console.error(`Failed to load node ${type}:`, error);
      }
    } else {
      console.warn(`Missing files for node ${type}:`, { configPath, processPath });
    }
  });

  // Wait for all nodes to load
  await Promise.all(nodeLoadPromises);

  // Load imports as node types
  if (flow.imports) {
    flow.imports.forEach(importDef => { 
      nodes[importDef.id] = this.convertImportToNodeType(importDef);
    });
  }

  return nodes;
}

/**
 * Load integrations
 * @returns {Object} Map of integration names to their instances (currently only OpenRouter is supported)
 */
export async function loadIntegrations(config) {
  const integrations = {};
  if (config.keys?.openrouter) {
      const openrouterPath = path.join(getDirname(import.meta.url), '../integrations', 'openrouter.js');
      try {
          const OpenRouterIntegration = await import(openrouterPath).then(module => module.default);
          integrations.openrouter = new OpenRouterIntegration(config.keys.openrouter, {
              baseURL: config.openrouterBaseURL || 'https://openrouter.ai/api/v1',
              referer: 'https://zv1.ai',
              title: 'zv1 by ZeroWidth'
          });
      } catch (error) {
          throw error;
      }
  }
  
  return integrations;
}