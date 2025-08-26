import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * Call an MCP tool for a given node, bound to the engine instance
 * @param {Object} node - The node to call the tool for
 * @param {Object} args - The arguments to pass to the tool
 * @returns {Object} The result of the tool call
 */
export async function callMCPTool(node, args) { 
  const url = node.settings?.url;
  if (!url) throw new Error(`No MCP URL specified for node ${node.id}`);

  // You may want to cache the tool name from the schema
  const toolName = node.settings?.toolName
  const id = uuidv4();
  try {
    const response = await axios.post(url, {
      id,
      method: "tools/call",
      params: {
        name: toolName,
        ...args
      }
    });
    // Return the result content (or the whole result if you want)
    return response.data?.result;
  } catch (err) {
    throw new Error(`Failed to call MCP tool at ${url}: ${err.message}`);
  }
}

/**
 * Fetch the MCP tool schema for a given node, bound to the engine instance
 * @param {Object} node - The node to fetch the schema for
 * @returns {Object} The MCP tool schema
 */
export async function fetchMCPToolSchema(node) {
  const url = node.settings?.url;
  if (!url) throw new Error(`No MCP URL specified for node ${node.id}`);

  if (!this._mcpSchemaCache) this._mcpSchemaCache = {};
  if (this._mcpSchemaCache[url]) return this._mcpSchemaCache[url];

  const id = uuidv4();
  try {
    const response = await axios.post(url, {
      id,
      method: "tools/list",
      params: {}
    });
    const tools = response.data?.result?.tools || [];
    // For now, just return the first tool (or you can match by name)
    const tool = tools[0];
    if (!tool) throw new Error(`No tools found at MCP endpoint ${url}`);
    // Convert MCP tool schema to your internal tool schema format if needed
    const schema = {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    };
    this._mcpSchemaCache[url] = schema;
    return schema;
  } catch (err) {
    throw new Error(`Failed to fetch MCP tool schema from ${url}: ${err.message}`);
  }
}