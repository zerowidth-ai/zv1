#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { execSync } = require('child_process');

// Define paths
const BASE_DIR = path.dirname(__filename);
const NODES_DIR = path.join(BASE_DIR, '../nodes');
const TYPES_DIR = path.join(BASE_DIR, '../types');
const TEST_FLOWS_DIR = path.join(BASE_DIR, '../tests');
const SDK_DIR = path.join(BASE_DIR, '../sdks');
const MASTER_CONFIG_PATH = path.join(BASE_DIR, '../nodes/all-nodes.config.json');
const COMPRESSED_MASTER_CONFIG_PATH = path.join(BASE_DIR, '../nodes/all-nodes-simple.config.json');

// SDK configuration
const SDK_TARGETS = {
    nodejs: {
        path: path.join(SDK_DIR, 'nodejs'),
        extensions: ['.js', '.ts']
    }
    // Add more SDKs as they become available
    // python: {
    //     path: path.join(SDK_DIR, 'python'),
    //     extensions: ['.py']
    // }
};

class NodeSyncWatcher {
    constructor(options = {}) {
        this.watchMode = options.watch || false;
        this.verbose = options.verbose || false;
        this.watchers = [];
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = this.watchMode ? `[${timestamp}]` : '';
        console.log(`${prefix} ${level.toUpperCase()}: ${message}`);
    }

    createMasterConfig() {
        this.log('Creating master configuration...');
        const masterConfig = [];

        if (!fs.existsSync(NODES_DIR)) {
            this.log(`Nodes directory not found: ${NODES_DIR}`, 'error');
            return;
        }

        const nodes = fs.readdirSync(NODES_DIR);
        
        for (const node of nodes) {
            const nodePath = path.join(NODES_DIR, node);
            if (fs.statSync(nodePath).isDirectory()) {
                const configFile = path.join(nodePath, `${node}.config.json`);
                if (fs.existsSync(configFile)) {
                    try {
                        const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                        configData.id = node;
                        masterConfig.push(configData);
                    } catch (error) {
                        this.log(`Error decoding JSON for ${configFile}: ${error.message}`, 'error');
                    }
                }
            }
        }

        // Write master config
        fs.writeFileSync(MASTER_CONFIG_PATH, JSON.stringify(masterConfig, null, 4));

        // Write compressed config
        const csvContent = [
            'id,display_name,description',
            ...masterConfig
                .sort((a, b) => a.id.localeCompare(b.id))
                .map(node => `${node.id},${node.display_name},${node.description}`)
        ].join('\n');
        
        fs.writeFileSync(COMPRESSED_MASTER_CONFIG_PATH, csvContent);

        this.log(`Master configuration created with ${masterConfig.length} entries`);
    }

    copyFile(src, dest) {
        try {
            // Ensure destination directory exists
            const destDir = path.dirname(dest);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            
            fs.copyFileSync(src, dest);
            this.log(`Copied: ${path.relative(BASE_DIR, src)} → ${path.relative(BASE_DIR, dest)}`);
        } catch (error) {
            this.log(`Error copying ${src} to ${dest}: ${error.message}`, 'error');
        }
    }

    syncNodeFile(nodeName, fileName, filePath) {
        const fileExt = path.extname(fileName);
        
        for (const [engine, engineInfo] of Object.entries(SDK_TARGETS)) {
            const targetNodeDir = path.join(engineInfo.path, 'nodes', nodeName);
            
            // Always copy config files
            if (fileName.endsWith('.json')) {
                const destFile = path.join(targetNodeDir, fileName);
                this.copyFile(filePath, destFile);
            }
            // Copy process files with matching extensions
            else if (engineInfo.extensions.includes(fileExt)) {
                const destFile = path.join(targetNodeDir, fileName);
                this.copyFile(filePath, destFile);
            }
            // Copy test files
            else if (fileName.endsWith('.tests.json')) {
                const destFile = path.join(targetNodeDir, fileName);
                this.copyFile(filePath, destFile);
            }
        }
    }

    syncTypesFile(fileName, filePath) {
        for (const [engine, engineInfo] of Object.entries(SDK_TARGETS)) {
            const targetTypesDir = path.join(engineInfo.path, 'types');
            const destFile = path.join(targetTypesDir, fileName);
            this.copyFile(filePath, destFile);
        }
    }

    syncTestFlowFile(fileName, filePath) {
        for (const [engine, engineInfo] of Object.entries(SDK_TARGETS)) {
            const targetTestFlowsDir = path.join(engineInfo.path, 'tests', 'flows');
            const destFile = path.join(targetTestFlowsDir, fileName);
            this.copyFile(filePath, destFile);
        }
    }

    syncAll() {
        this.log('Starting full sync...');
        
        // Create master config
        this.createMasterConfig();

        // Sync all nodes
        if (fs.existsSync(NODES_DIR)) {
            const nodes = fs.readdirSync(NODES_DIR);
            for (const node of nodes) {
                const nodePath = path.join(NODES_DIR, node);
                if (fs.statSync(nodePath).isDirectory()) {
                    const files = fs.readdirSync(nodePath);
                    for (const file of files) {
                        const filePath = path.join(nodePath, file);
                        if (fs.statSync(filePath).isFile()) {
                            this.syncNodeFile(node, file, filePath);
                        }
                    }
                }
            }
        }

        // Sync types
        if (fs.existsSync(TYPES_DIR)) {
            const typeFiles = fs.readdirSync(TYPES_DIR);
            for (const file of typeFiles) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(TYPES_DIR, file);
                    this.syncTypesFile(file, filePath);
                }
            }
        }

        // Sync test flows
        if (fs.existsSync(TEST_FLOWS_DIR)) {
            const testFiles = fs.readdirSync(TEST_FLOWS_DIR);
            for (const file of testFiles) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(TEST_FLOWS_DIR, file);
                    this.syncTestFlowFile(file, filePath);
                }
            }
        }

        this.log('Full sync completed');
    }

    startWatching() {
        this.log('Starting file watcher...');
        this.log(`Watching: ${NODES_DIR}, ${TYPES_DIR}, ${TEST_FLOWS_DIR}`);

        // Watch nodes directory
        const nodesWatcher = chokidar.watch(NODES_DIR, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true
        });

        nodesWatcher
            .on('add', (filePath) => {
                const relativePath = path.relative(NODES_DIR, filePath);
                const pathParts = relativePath.split(path.sep);
                if (pathParts.length >= 2) {
                    const nodeName = pathParts[0];
                    const fileName = pathParts[1];
                    this.log(`New file detected: ${relativePath}`);
                    this.syncNodeFile(nodeName, fileName, filePath);
                }
            })
            .on('change', (filePath) => {
                const relativePath = path.relative(NODES_DIR, filePath);
                const pathParts = relativePath.split(path.sep);
                if (pathParts.length >= 2) {
                    const nodeName = pathParts[0];
                    const fileName = pathParts[1];
                    this.log(`File changed: ${relativePath}`);
                    this.syncNodeFile(nodeName, fileName, filePath);
                }
            })
            .on('unlink', (filePath) => {
                const relativePath = path.relative(NODES_DIR, filePath);
                this.log(`File removed: ${relativePath}`);
                // TODO: Handle file removal
            });

        // Watch types directory
        const typesWatcher = chokidar.watch(TYPES_DIR, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true
        });

        typesWatcher
            .on('add', (filePath) => {
                const fileName = path.basename(filePath);
                this.log(`New types file: ${fileName}`);
                this.syncTypesFile(fileName, filePath);
            })
            .on('change', (filePath) => {
                const fileName = path.basename(filePath);
                this.log(`Types file changed: ${fileName}`);
                this.syncTypesFile(fileName, filePath);
            });

        // Watch test flows directory
        const testFlowsWatcher = chokidar.watch(TEST_FLOWS_DIR, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true
        });

        testFlowsWatcher
            .on('add', (filePath) => {
                const fileName = path.basename(filePath);
                this.log(`New test flow: ${fileName}`);
                this.syncTestFlowFile(fileName, filePath);
            })
            .on('change', (filePath) => {
                const fileName = path.basename(filePath);
                this.log(`Test flow changed: ${fileName}`);
                this.syncTestFlowFile(fileName, filePath);
            });

        this.watchers = [nodesWatcher, typesWatcher, testFlowsWatcher];

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            this.log('Shutting down watchers...');
            this.watchers.forEach(watcher => watcher.close());
            process.exit(0);
        });

        this.log('File watcher started. Press Ctrl+C to stop.');
    }

    stop() {
        this.watchers.forEach(watcher => watcher.close());
        this.log('Watchers stopped');
    }
}

// CLI interface
function main() {
    const args = process.argv.slice(2);
    const options = {
        watch: args.includes('--watch') || args.includes('-w'),
        verbose: args.includes('--verbose') || args.includes('-v'),
        help: args.includes('--help') || args.includes('-h')
    };

    if (options.help) {
        console.log(`
Usage: node sync-watcher.js [options]

Options:
  -w, --watch     Watch for file changes and auto-sync
  -v, --verbose   Enable verbose logging
  -h, --help      Show this help message

Examples:
  node sync-watcher.js              # One-time sync
  node sync-watcher.js --watch      # Watch and auto-sync
  node sync-watcher.js -w -v        # Watch with verbose logging
        `);
        return;
    }

    const watcher = new NodeSyncWatcher(options);

    if (options.watch) {
        // Do initial sync
        watcher.syncAll();
        // Start watching
        watcher.startWatching();
    } else {
        // One-time sync
        watcher.syncAll();
    }
}

// Check if chokidar is available
try {
    require.resolve('chokidar');
} catch (error) {
    console.error('Error: chokidar is required but not installed.');
    console.error('Please run: npm install chokidar');
    process.exit(1);
}

if (require.main === module) {
    main();
}

module.exports = NodeSyncWatcher;
