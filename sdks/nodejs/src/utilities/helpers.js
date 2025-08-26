import { fileURLToPath } from 'url';
import { dirname } from 'path';


/**
 * Create a safe tool name
 * @param {string} name - The name to make safe
 * @returns {string} The safe name
 */
export function createSafeToolName(name) {
  // make match ^[a-zA-Z0-9_-]+$
  return name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

/**
 * Check if a node is a remote MCP tool
 * @param {Object} node - The node to check
 * @returns {boolean} Whether the node is a remote MCP tool
 */
export function isRemoteMCPTool(node) {
  return node.type === "remote-mcp-tool";
}

/**
 * Check if a node is a manual tool node
 * @param {Object} node - The node to check
 * @returns {boolean} Whether the node is a manual tool node
 */
export function isManualToolNode(node) {
  return node.type === "tool";
}


/**
 * Map node semantic input types to JSON Schema types for tool parameters
 * @param {string} type - The type to map
 * @returns {string} The JSON Schema type
 */
export function mapTypeToJSONSchema(type) {
  // Map node input types to JSON Schema types for tool parameters
  if (!type) return "string";
  const t = type.toLowerCase();
  if (t === "number" || t === "integer") return "number";
  if (t === "boolean") return "boolean";
  if (t.startsWith("array")) return "array";
  if (t === "object") return "object";
  return "string";
}

export function getFilename(metaUrl) {
  return fileURLToPath(metaUrl);
}

export function getDirname(metaUrl) {
  return dirname(getFilename(metaUrl));
}
