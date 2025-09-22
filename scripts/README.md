# ZV1 Sync Scripts

This directory contains scripts for synchronizing shared assets across the zv1 monorepo.

## Scripts

### sync_sdks.py
The original Python script for one-time synchronization of nodes, types, and test flows to all SDKs.

### sync-watcher.js
A Node.js file watcher that automatically syncs changes from the `/nodes`, `/types`, and `/tests` directories to language-specific SDKs in real-time.

## Installation

```bash
cd scripts
npm install
```

## Usage

### One-time sync
```bash
npm run sync
# or
node sync-watcher.js
```

### Watch mode (auto-sync on changes)
```bash
npm run watch
# or
node sync-watcher.js --watch
```

### Development mode (watch with verbose logging)
```bash
npm run dev
# or
node sync-watcher.js --watch --verbose
```

## Features

- **Real-time watching**: Automatically detects file changes in `/nodes`, `/types`, and `/tests` directories
- **Selective copying**: Only copies files with extensions relevant to each SDK (e.g., `.js`/`.ts` for Node.js)
- **Master config generation**: Creates `all-nodes.config.json` and `all-nodes-simple.config.json`
- **Verbose logging**: Optional detailed logging for debugging
- **Graceful shutdown**: Handles Ctrl+C properly

## Development Workflow

1. Start the watcher in development mode:
   ```bash
   npm run dev
   ```

2. Make changes to files in `/nodes`, `/types`, or `/tests` directories

3. The watcher will automatically copy relevant files to the appropriate SDK directories

4. Press Ctrl+C to stop the watcher

## Supported SDKs

Currently supports:
- **Node.js** (`.js`, `.ts` files)

Future SDKs can be easily added by updating the `SDK_TARGETS` configuration in `sync-watcher.js`.
