import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";

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
      const nodeType = this.convertImportToNodeType(importDef);
      // Store with both the import ID and the prefixed name for backward compatibility
      nodes[importDef.id] = nodeType;
      nodes[`imported-${importDef.id}`] = nodeType;
    });
  }

  return nodes;
}

/**
 * Load integrations
 * @param {Object} config - Configuration object
 * @param {Object} flow - Flow object (may contain knowledgeDbPath)
 * @returns {Object} Map of integration names to their instances
 */
export async function loadIntegrations(config, flow = null) {
  const integrations = {};
  
  // Load OpenRouter integration if API key is provided
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
  
  // Load knowledge base integration if available
  const knowledgeBaseType = config.knowledgeBase?.type || 'sqlite';
  const knowledgeBaseConfig = config.knowledgeBase || {};
  
  if (flow?.knowledgeDbPath || knowledgeBaseConfig.enabled !== false) {
      
      
      try {
          // Load the appropriate knowledge base integration
          const knowledgeBasePath = path.join(getDirname(import.meta.url), '../integrations', `${knowledgeBaseType}.js`);
          const KnowledgeBaseIntegration = await import(knowledgeBasePath).then(module => module.default);
          
          // Create integration instance with appropriate options
          let integrationOptions = {
              timeout: config.sqliteTimeout || 5000,
              ...knowledgeBaseConfig.options
          };
          
          if (knowledgeBaseType === 'sqlite' && flow?.knowledgeDbPath) {
              integrations.knowledgeBase = new KnowledgeBaseIntegration(flow.knowledgeDbPath, integrationOptions);
              
          } else if (knowledgeBaseType !== 'sqlite') {
              // For other knowledge base types, pass the config directly
              integrations.knowledgeBase = new KnowledgeBaseIntegration(knowledgeBaseConfig, integrationOptions);
              
          }
          
          // Also keep the old sqlite key for backward compatibility
          if (knowledgeBaseType === 'sqlite') {
              integrations.sqlite = integrations.knowledgeBase;
          }
          
      } catch (error) {
          console.warn(`[WARN] Failed to load ${knowledgeBaseType} knowledge base integration:`, error.message);
          console.warn('[WARN] Error details:', error);
          // Don't throw error - knowledge base is optional
      }
  }
  
  // Load OpenAI integration if API key is provided
  if (config.keys?.openai) {
      const openaiPath = path.join(getDirname(import.meta.url), '../integrations', 'openai.js');
      try {
          const OpenAIIntegration = await import(openaiPath).then(module => module.default);
          integrations.openai = new OpenAIIntegration(config.keys.openai, {
              timeout: config.openaiTimeout || 30000
          });
          
      } catch (error) {
          console.warn('[WARN] Failed to load OpenAI integration:', error.message);
          // Don't throw error - OpenAI is optional
      }
  }
  
  return integrations;
}

/**
 * Load a .zv1 file and extract its contents
 * .zv1 files are ZIP archives containing orchestration.json and optional imports folder
 * 
 * @param {string} filePath - Path to the .zv1 file
 * @returns {Promise<Object>} Extracted flow object with orchestration.json and imports
 * @throws {Error} If file doesn't exist, is not a valid ZIP, or missing orchestration.json
 */
export async function loadZv1File(filePath) {
  
  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`Zv1 file not found: ${filePath}`);
  }

  // Validate file extension
  if (!filePath.endsWith('.zv1')) {
    throw new Error(`Invalid file extension. Expected .zv1, got: ${path.extname(filePath)}`);
  }

  try {
    // Extract ZIP contents
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();

    // Find orchestration.json (required)
    const orchestrationEntry = zipEntries.find(entry => 
      entry.entryName === 'orchestration.json' || 
      entry.entryName === './orchestration.json'
    );

    if (!orchestrationEntry) {
      throw new Error('Missing required orchestration.json file in .zv1 archive');
    }

    // Parse orchestration.json
    const orchestrationContent = orchestrationEntry.getData().toString('utf8');
    let orchestrationData;
    try {
      orchestrationData = JSON.parse(orchestrationContent);
    } catch (parseError) {
      throw new Error(`Invalid JSON in orchestration.json: ${parseError.message}`);
    }

    // Validate orchestration.json structure
    if (!orchestrationData.nodes || !Array.isArray(orchestrationData.nodes)) {
      throw new Error('orchestration.json must contain a "nodes" array');
    }
    if (!orchestrationData.links || !Array.isArray(orchestrationData.links)) {
      throw new Error('orchestration.json must contain a "links" array');
    }

    // Handle imports - support both legacy array format and new object format
    let imports = [];
    
    if (orchestrationData.imports) {
      if (Array.isArray(orchestrationData.imports)) {
        // Legacy format: imports as array (backward compatibility)
        imports = orchestrationData.imports;
      } else if (typeof orchestrationData.imports === 'object') {
        // New format: imports as object { "import-id": "snapshot" }
        imports = await loadZv1ImportsFromObject(orchestrationData.imports, zipEntries);
      }
    }

    // Look for knowledge.db file (optional)
    let knowledgeDbPath = null;
    const knowledgeDbEntry = zipEntries.find(entry => 
      entry.entryName === 'knowledge.db' || 
      entry.entryName === './knowledge.db'
    );

    

    if (knowledgeDbEntry) {
      // Extract knowledge.db to a temporary location
      const tempDir = path.join(process.cwd(), '.temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      knowledgeDbPath = path.join(tempDir, `knowledge_${orchestrationData.id}.db`);
      
      // Use file locking to prevent conflicts between multiple engine instances
      const lockPath = `${knowledgeDbPath}.lock`;
      const maxRetries = 10;
      const retryDelay = 100; // ms
      
      let retries = 0;
      while (retries < maxRetries) {
        try {
          // Try to create lock file atomically
          fs.writeFileSync(lockPath, process.pid.toString(), { flag: 'wx' });
          break; // Success, we got the lock
        } catch (error) {
          if (error.code === 'EEXIST') {
            // Lock file exists, wait and retry
            retries++;
            if (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              continue;
            } else {
              throw new Error(`Could not acquire lock for knowledge database after ${maxRetries} retries`);
            }
          } else {
            throw error;
          }
        }
      }
      
      try {
        fs.writeFileSync(knowledgeDbPath, knowledgeDbEntry.getData());
      } finally {
        // Always release the lock
        try {
          fs.unlinkSync(lockPath);
        } catch (error) {
          // Ignore lock cleanup errors
        }
      }
    
    }

    // Return unified flow structure
    return {
      ...orchestrationData,
      imports: imports,
      knowledgeDbPath: knowledgeDbPath
    };

  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to load .zv1 file: ${error.message}`);
  }
}

/**
 * Load imports from the new imports object format
 * Maps import IDs to their corresponding folders and loads them
 * 
 * @param {Object} importsObject - Object mapping import IDs to snapshots
 * @param {Array<AdmZip.IZipEntry>} zipEntries - All ZIP entries
 * @returns {Promise<Array>} Array of loaded import definitions
 * @throws {Error} If import folders cannot be found or loaded
 */
async function loadZv1ImportsFromObject(importsObject, zipEntries) {
  const imports = [];
  
  // Find all import folder entries
  const importEntries = zipEntries.filter(entry => 
    entry.entryName.startsWith('imports/') && 
    entry.entryName !== 'imports/' &&
    !entry.entryName.endsWith('/')
  );

  // Group import entries by folder name
  const importFolders = new Map();
  for (const entry of importEntries) {
    const pathParts = entry.entryName.split('/');
    if (pathParts.length >= 2) {
      const folderName = pathParts[1]; // imports/folderName/...
      if (!importFolders.has(folderName)) {
        importFolders.set(folderName, new Map());
      }
      const relativePath = pathParts.slice(2).join('/');
      importFolders.get(folderName).set(relativePath, entry);
    }
  }

  // Load each import based on the imports object
  for (const [importId, snapshot] of Object.entries(importsObject)) {
    try {
      // Find the folder that matches this import ID and snapshot
      const folderName = findImportFolder(importId, snapshot, importFolders);
      
      if (!folderName) {
        throw new Error(`Import '${importId}' with snapshot '${snapshot}' not found`);
      }

      const folderEntries = importFolders.get(folderName);
      const importData = await loadZv1ImportFolder(folderName, folderEntries);
      
      // Add the import ID for reference
      importData.importId = importId;
      importData.requestedSnapshot = snapshot;
      
      imports.push(importData);
      
    } catch (importError) {
      throw new Error(`Failed to load import '${importId}' (${snapshot}): ${importError.message}`);
    }
  }

  return imports;
}

/**
 * Find the import folder that matches the given import ID and version range
 * 
 * @param {string} importId - The import ID (e.g., auto-generated UUID)
 * @param {string} versionRange - The requested version range (e.g., "^1.2.3", "~1.2.3", "1.2.3", "latest")
 * @param {Map<string, Map>} importFolders - Available import folders
 * @returns {string|null} The matching folder name or null if not found
 */
function findImportFolder(importId, versionRange, importFolders) {
  // With simplified folder naming, we just look for the import ID directly
  // Version information is stored in the import's orchestration.json metadata
  
  // Strategy 1: Look for exact match with import ID
  if (importFolders.has(importId)) {
    return importId;
  }

  // Strategy 2: Look for any folder that contains this import ID anywhere in the name
  for (const folderName of importFolders.keys()) {
    if (folderName.includes(importId)) {
      return folderName;
    }
  }

  return null;
}


/**
 * Load an import folder from a .zv1 file
 * Each import folder contains its own orchestration.json and optional nested imports
 * 
 * @param {string} folderName - Name of the import folder (e.g., "my-file.latest.135235g24s34")
 * @param {Map<string, AdmZip.IZipEntry>} folderEntries - Map of relative paths to ZIP entries
 * @returns {Promise<Object>} Import definition object
 * @throws {Error} If orchestration.json is missing or invalid
 */
async function loadZv1ImportFolder(folderName, folderEntries) {
  // Find orchestration.json in this import folder
  const orchestrationEntry = folderEntries.get('orchestration.json');
  if (!orchestrationEntry) {
    throw new Error(`Missing orchestration.json in import folder '${folderName}'`);
  }

  // Parse orchestration.json
  const orchestrationContent = orchestrationEntry.getData().toString('utf8');
  let orchestrationData;
  try {
    orchestrationData = JSON.parse(orchestrationContent);
  } catch (parseError) {
    throw new Error(`Invalid JSON in import folder '${folderName}/orchestration.json': ${parseError.message}`);
  }

  // Validate orchestration.json structure
  if (!orchestrationData.nodes || !Array.isArray(orchestrationData.nodes)) {
    throw new Error(`Import folder '${folderName}' orchestration.json must contain a "nodes" array`);
  }
  if (!orchestrationData.links || !Array.isArray(orchestrationData.links)) {
    throw new Error(`Import folder '${folderName}' orchestration.json must contain a "links" array`);
  }

  // Parse folder name - now just the import ID
  const importId = orchestrationData.id;
  
  // New simplified format: just importId
  // Generate a unique ID from the import ID for backward compatibility
  // uniqueId = importId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
  let displayName = orchestrationData.metadata?.display_name || importId; // Use import ID as display name
  let snapshot = orchestrationData.metadata?.snapshot || 'unknown'; // Get version from metadata

  // Look for knowledge.db file in this import folder (optional)
  let knowledgeDbPath = null;
  const knowledgeDbEntry = folderEntries.get('knowledge.db');
  if (knowledgeDbEntry) {
    // Extract knowledge.db to a temporary location
    const tempDir = path.join(process.cwd(), '.temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    knowledgeDbPath = path.join(tempDir, `knowledge_${importId}.db`);
    fs.writeFileSync(knowledgeDbPath, knowledgeDbEntry.getData());
  }

  // Look for nested imports in this folder
  const nestedImportEntries = new Map();
  for (const [relativePath, entry] of folderEntries) {
    if (relativePath.startsWith('imports/')) {
      const nestedPath = relativePath.substring(8); // Remove 'imports/' prefix
      nestedImportEntries.set(nestedPath, entry);
    }
  }

  // Load nested imports if they exist
  let nestedImports = [];
  if (nestedImportEntries.size > 0) {
    // Group nested import entries by folder name
    const nestedImportFolders = new Map();
    for (const [nestedPath, entry] of nestedImportEntries) {
      const pathParts = nestedPath.split('/');
      if (pathParts.length >= 1) {
        const nestedFolderName = pathParts[0];
        if (!nestedImportFolders.has(nestedFolderName)) {
          nestedImportFolders.set(nestedFolderName, new Map());
        }
        const relativePath = pathParts.slice(1).join('/');
        nestedImportFolders.get(nestedFolderName).set(relativePath, entry);
      }
    }

    // Load each nested import folder
    for (const [nestedFolderName, nestedFolderEntries] of nestedImportFolders) {
      try {
        const nestedImportData = await loadZv1ImportFolder(nestedFolderName, nestedFolderEntries);
        nestedImports.push(nestedImportData);
      } catch (nestedError) {
        throw new Error(`Failed to load nested import '${nestedFolderName}' in '${folderName}': ${nestedError.message}`);
      }
    }
  }

  // Return import definition with metadata
  return {
    id: `imported-${importId}`,
    display_name: displayName,
    snapshot: snapshot,
    unique_id: importId,
    folder_name: folderName,
    nodes: orchestrationData.nodes,
    links: orchestrationData.links,
    imports: nestedImports,
    knowledgeDbPath: knowledgeDbPath,
    // Preserve any additional metadata from orchestration.json
    ...orchestrationData
  };
}

/**
 * Convert legacy imports array to the new unified format
 * Legacy format has imports as an array of full orchestration objects
 * New format has imports as an array of import definitions with metadata
 * 
 * @param {Array<Object>} legacyImports - Array of legacy import objects
 * @returns {Array<Object>} Array of converted import definitions
 */
export function convertLegacyImports(legacyImports) {
  if (!Array.isArray(legacyImports)) {
    return [];
  }

  return legacyImports.map((legacyImport, index) => {
    // Generate a unique ID if not present
    const uniqueId = legacyImport.id || `legacy-import-${index}-${Date.now()}`;
    
    // Extract display name from legacy import
    const displayName = legacyImport.display_name || legacyImport.name || `Legacy Import ${index + 1}`;
    
    // Create snapshot identifier (legacy imports don't have versioning)
    const snapshot = legacyImport.snapshot || 'legacy';
    
    return {
      id: `imported-${uniqueId}`,
      display_name: displayName,
      snapshot: snapshot,
      unique_id: uniqueId,
      folder_name: `${displayName}.${snapshot}.${uniqueId}`,
      nodes: legacyImport.nodes || [],
      links: legacyImport.links || [],
      imports: convertLegacyImports(legacyImport.imports || []), // Recursively convert nested imports
      // Preserve any additional metadata
      ...legacyImport
    };
  });
}

/**
 * Detect the input format and load accordingly
 * Supports legacy JSON files, new .zv1 files, and raw ZIP data in memory
 * 
 * @param {string|Object|Buffer} input - File path (string), flow object (Object), or ZIP data (Buffer)
 * @returns {Promise<Object>} Unified flow object ready for engine initialization
 * @throws {Error} If input format is unsupported or file cannot be loaded
 */
export async function detectAndLoadFlow(input) {
  
  // If input is already an object, it's either a legacy flow or already processed
  if (typeof input === 'object' && input !== null && !Buffer.isBuffer(input)) {
  
    // Check if it's already in the new format (has imports array)
    if (Array.isArray(input.imports)) {
      return input;
    }
    
    // Check if it's a legacy flow with imports array
    if (Array.isArray(input.imports)) {
      return {
        ...input,
        imports: convertLegacyImports(input.imports)
      };
    }
    
    // Legacy flow without imports - return as-is
    return input;
  }

  // If input is a Buffer, treat it as raw ZIP data (.zv1 file in memory)
  if (Buffer.isBuffer(input)) {
    return await loadZv1FromBuffer(input);
  }

  // Input is a string - treat as file path
  if (typeof input === 'string') {
    const filePath = path.resolve(input);
    
    // Check file extension to determine format
    if (filePath.endsWith('.zv1')) {
      return await loadZv1File(filePath);
    } else if (filePath.endsWith('.json')) {
      // Load legacy JSON file
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const flowData = JSON.parse(fileContent);
      
      // Convert legacy imports if present
      if (Array.isArray(flowData.imports)) {
        flowData.imports = convertLegacyImports(flowData.imports);
      }
      
      return flowData;
    } else {
      throw new Error(`Unsupported file format. Expected .zv1 or .json, got: ${path.extname(filePath)}`);
    }
  }

  throw new Error('Invalid input type. Expected file path (string), flow object, or ZIP data (Buffer).');
}

/**
 * Load a .zv1 file from raw ZIP data in memory
 * This allows loading .zv1 files without writing them to disk first
 * 
 * @param {Buffer} zipBuffer - Raw ZIP data as Buffer
 * @returns {Promise<Object>} Extracted flow object with orchestration.json and imports
 * @throws {Error} If buffer is not valid ZIP data or missing orchestration.json
 */
export async function loadZv1FromBuffer(zipBuffer) {
  // Validate that we have a Buffer
  if (!Buffer.isBuffer(zipBuffer)) {
    throw new Error('Input must be a Buffer containing ZIP data');
  }

  // Validate ZIP file signature (PK header)
  if (zipBuffer.length < 4 || zipBuffer[0] !== 0x50 || zipBuffer[1] !== 0x4B) {
    throw new Error('Invalid ZIP data: Missing ZIP file signature');
  }

  try {
    // Create AdmZip instance from buffer
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    // Find orchestration.json (required)
    const orchestrationEntry = zipEntries.find(entry => 
      entry.entryName === 'orchestration.json' || 
      entry.entryName === './orchestration.json'
    );

    if (!orchestrationEntry) {
      throw new Error('Missing required orchestration.json file in .zv1 archive');
    }

    // Parse orchestration.json
    const orchestrationContent = orchestrationEntry.getData().toString('utf8');
    let orchestrationData;
    try {
      orchestrationData = JSON.parse(orchestrationContent);
    } catch (parseError) {
      throw new Error(`Invalid JSON in orchestration.json: ${parseError.message}`);
    }

    // Validate orchestration.json structure
    if (!orchestrationData.nodes || !Array.isArray(orchestrationData.nodes)) {
      throw new Error('orchestration.json must contain a "nodes" array');
    }
    if (!orchestrationData.links || !Array.isArray(orchestrationData.links)) {
      throw new Error('orchestration.json must contain a "links" array');
    }

    // Handle imports - support both legacy array format and new object format
    let imports = [];
    
    if (orchestrationData.imports) {
      if (Array.isArray(orchestrationData.imports)) {
        // Legacy format: imports as array (backward compatibility)
        imports = orchestrationData.imports;
      } else if (typeof orchestrationData.imports === 'object') {
        // New format: imports as object { "import-id": "snapshot" }
        imports = await loadZv1ImportsFromObject(orchestrationData.imports, zipEntries);
      }
    }

    // Look for knowledge.db file (optional)
    let knowledgeDbPath = null;
    const knowledgeDbEntry = zipEntries.find(entry => 
      entry.entryName === 'knowledge.db' || 
      entry.entryName === './knowledge.db'
    );


    if (knowledgeDbEntry) {
      // Extract knowledge.db to a temporary location
      const tempDir = path.join(process.cwd(), '.temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      knowledgeDbPath = path.join(tempDir, `knowledge_${orchestrationData.id}.db`);
      fs.writeFileSync(knowledgeDbPath, knowledgeDbEntry.getData());
    }

    // Return unified flow structure
    return {
      ...orchestrationData,
      imports: imports,
      knowledgeDbPath: knowledgeDbPath
    };

  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to load .zv1 from buffer: ${error.message}`);
  }
}