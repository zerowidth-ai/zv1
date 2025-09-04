# zv1

A Node.js implementation of ZeroWidth's zv1 framework for executing AI and automation workflows through a visual node-based interface. Design flows on zv1.ai, export as JSON, and execute with precision and control.

[![Apache 2.0 License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Nodes & Links](#nodes--links)
  - [Flow Processing](#flow-processing)
  - [Input/Output System](#inputoutput-system)
- [API Keys & Security](#api-keys--security)
- [Event Handlers](#event-handlers)
- [Error Handling](#error-handling)
- [Advanced Features](#advanced-features)
- [Testing & Development](#testing)
- [API Reference](#api-reference)
- [Examples](#examples)

## Overview

The zv1 Flow Engine enables you to:
- Execute complex AI and automation workflows
- Connect various node types (data processing, AI models, tools, testing utilities)
- Handle asynchronous operations with precision
- Monitor and debug flow execution with detailed timelines
- Integrate with external systems and APIs
- Test error handling and recovery scenarios
- Manage costs and resource usage

## Installation

```bash
npm install zv1
```

## Quick Start

```javascript
import zv1 from 'zv1';

// Create engine instance by passing the location of your configured flow
const engine = await zv1.create('./path/to/myflow.zv1', {
  keys: {
    openrouter: process.env.OPENROUTER_API_KEY
  }
});

// Run the flow
const result = await engine.run({
  chat: [
    {
      role: 'user',
      content: "Hello, world!"
    }
  ]
});
```

## Core Concepts

### Nodes & Links

Nodes are the building blocks of your flow, connected by links that define data flow.

#### Node Types

1. **Input Nodes**
   - `input-data`: Structured data entry point
   - `input-chat`: Chat message arrays
   - `input-prompt`: String prompts
   
   ```json
   {
     "id": "input1",
     "type": "input-data",
     "settings": {
       "key": "userInput",
       "default_value": "Hello"
     }
   }
   ```

2. **Output Nodes**
   - `output-data`: Return structured data
   - `output-chat`: Return chat messages
   ```json
   {
     "id": "output1",
     "type": "output-data",
     "settings": {
       "key": "result"
     }
   }
   ```

3. **Constant Nodes**
   - Provide fixed values
   - No input connections required
   - Process first in execution order

4. **Testing Nodes**
   - `throw-error`: Always throws a custom error message
   - `null-bomb`: Randomly returns null/undefined based on probability
   - `self-healing-error`: Fails initially but succeeds on retry
   - `random-error`: Randomly throws errors based on probability

### Flow Processing

The engine follows a specific order of operations:

1. **Initialization**
   - Use `zv1.create()` to asynchronously load node definitions and custom types
   - Validate flow structure
   - Setup execution environment
   - Initialize ErrorManager

2. **Execution Order**
   ```
   Constant Nodes → Input Nodes → Processing Nodes → Output/Terminal Nodes
   ```

3. **Terminal Node Handling**
   When no output nodes exist, the engine returns:
   ```javascript
   {
     partial: true,
     message: "Flow completed without output nodes",
     terminal_nodes: [
       {
         node_id: "node1",
         type: "processor",
         outputs: { ... }
       }
     ]
   }
   ```

### Input/Output System

The engine supports various data types and structures:

```javascript
// Input format
const inputs = {
  data: {
    key1: "value1",
    key2: 42
  },
  chat: [
    { role: "user", content: "Hello" }
  ],
  prompt: "Generate a story about..."
};

// Output format
const outputs = {
  data: result,
  chat: responseMessages
};
```

## API Keys & Security

The engine supports secure API key management for nodes that require external service authentication.

### Configuration

```javascript
const engine = await zv1.create(flow, {
  keys: {
    openrouter: "sk-...",  // OpenRouter API key
  }
});
```

### Node Key Requirements

Nodes specify their key requirements in their configuration. All LLMs are configured by default to use OpenRouter, but this can be overridden.

```json
{
  "config": {
    "needs_key_from": ["openai"],
    "display_name": "GPT-4 Node",
    "description": "Processes text with GPT-4"
  }
}
```

The engine validates key availability before execution.

## Event Handlers

Monitor and extend flow execution with event handlers:

```javascript
const engine = await zv1.create(flow, {
  onNodeStart: async ({ nodeId, nodeType, timestamp, inputs, settings }) => {
    console.log(`Node ${nodeId} starting execution`);
    // Example: Track metrics in your own system
    // await yourMetricsService.recordNodeStart(nodeId, timestamp);
  },
  
  onNodeComplete: async ({ nodeId, nodeType, timestamp, inputs, outputs, settings }) => {
    console.log(`Node ${nodeId} completed execution`);
    // Example: Calculate and track execution duration
    // const duration = timestamp - startTime;
    // await yourMetricsService.recordNodeComplete(nodeId, duration);
  },

  onNodeUpdate: async ({ nodeId, nodeType, timestamp, data }) => {
    console.log(`Node ${nodeId} sent update:`, data);
    // Example: Handle real-time updates from nodes
  },
  
  onError: async (errorEvent) => {
    console.log('Error occurred:', errorEvent);
    // Example: Send to your error tracking service
    // await yourErrorTracker.recordError(errorEvent);
  }
});
```

Common use cases:
- Performance monitoring
- Progress tracking
- Streaming LLM tokens via onNodeUpdate
- Debug logging
- Resource management
- External system integration
- Error tracking and alerting

## Error Handling

The engine includes a comprehensive ErrorManager for centralized error handling and detailed error reporting.

### Error Types

- **`node`**: Errors occurring during node execution
- **`flow`**: Errors related to flow structure or validation
- **`system`**: System-level errors
- **`validation`**: Input/output validation errors
- **`timeout`**: Execution timeout errors
- **`resource`**: Resource allocation or access errors

### Error Context

When verbose mode is enabled, errors include rich execution context:

```javascript
{
  errorType: "node",
  message: "Node execution failed: Custom error message",
  executionId: "uuid-1234",
  nodeId: "node-1",
  nodeType: "custom-node",
  errorDetails: {
    timeline: [...],
    nodeCount: 5,
    nodesExecuted: 3,
    cost_summary: { total: 0.05, itemized: [...] }
  }
}
```

### Error Recovery

The engine supports both fatal and recoverable errors:

```javascript
// Fatal errors stop execution
if (errorType === 'system') {
  throw new Error('Critical system failure');
}

// Recoverable errors allow retry logic
if (errorType === 'node' && retryCount < maxRetries) {
  // Retry node execution
}
```

## Advanced Features

### Plugin System

Support for LLM plugins and tools:

```javascript
// Tool schema definition
{
  "name": "calculator",
  "description": "Performs calculations",
  "parameters": {
    "type": "object",
    "properties": {
      "operation": { "type": "string" },
      "numbers": { "type": "array" }
    }
  }
}
```

### MCP (Model Context Protocol) Support

Integrate with external tools via MCP:

```javascript
const engine = await zv1.create(flow, {
  mcp: {
    tools: [
      {
        name: "getTime",
        description: "Get current time",
        url: "http://localhost:3000/mcp"
      }
    ]
  }
});
```

### Custom Node Types

Create custom nodes by implementing:
1. Configuration file (`nodeType.config.json`)
2. Process function (`nodeType.process.js`)

### Cost Tracking

Monitor resource usage with built-in cost tracking:

```javascript
const result = await engine.run(inputs);
console.log('Total cost:', result.cost_summary.total);
console.log('Itemized costs:', result.cost_summary.itemized);
```

## Testing & Development

To prevent duplication and stay organized, shared internal dependencies for each SDK are not kept in each language specific directory. Use the `sync_sdks.py` script at the root of this directory to pull in the `/nodes`, `/types`, and `/tests` to each SDK for development. Packaged bundles are shipped with this step already completed and this is not necessary for basic use OR if this package was installed via npm/yarn. You will only need to run the sync script if you are accessing this by checking out this repo directly.

```bash
python sync_sdks.py
```

Run the comprehensive test suites:

```bash
# Test individual nodes using their <node>.tests.json configuration
npm run test-nodes

# Test complete flows stored within /tests/flows
npm run test-flows
```

### Advanced Node Testing Options

The node testing script supports several command-line options for efficient development and debugging:

```bash
# Test all nodes (default behavior)
node tests/test.all-nodes.js

# Test a specific node only
node tests/test.all-nodes.js --node absolute
node tests/test.all-nodes.js --node anthropic-claude-3-5-sonnet

# Resume testing from a specific node (useful after failures)
node tests/test.all-nodes.js --start-from array-map

# Show help and usage information
node tests/test.all-nodes.js --help

# Legacy support: positional argument for single node
node tests/test.all-nodes.js absolute
```

**Use Cases:**
- **Single Node Testing**: Quickly test a specific node during development with `--node`
- **Resume Testing**: Continue from where a test run failed using `--start-from`
- **Debugging**: Focus on problematic nodes without running the entire suite
- **Development**: Test only the nodes you're actively working on

**Error Handling:**
- Invalid node names display available options
- Conflicting options (e.g., `--node` and `--start-from`) are rejected
- Nodes are processed in alphabetical order for consistent `--start-from` behavior

### Test Flow Format

Create test flows in `tests/flows/` directory:

```json
{
  "flow": {
    "nodes": [...],
    "links": [...]
  },
  "inputs": { ... },
  "expected": { ... },
  "expectedSchema": { ... },
  "expectedError": {
    "type": "node",
    "message": "Expected error message",
    "nodeId": "node-1",
    "nodeType": "custom-node"
  }
}
```

### Testing Utilities

The engine includes specialized testing nodes:

- **`throw-error`**: Test error handling scenarios
- **`null-bomb`**: Test null/undefined handling
- **`self-healing-error`**: Test retry and recovery logic
- **`random-error`**: Test probabilistic error conditions

## API Reference

### zv1 Class

```javascript
class zv1 {
  
  /**
   * Create a new zv1 instance (recommended)
   * @param {Object} flow - The flow definition containing nodes and links
   * @param {Object} config - Configuration options and context for the engine
   * @returns {Promise<zv1>} Fully initialized zv1 instance
   */
  static async create(flow, config)
  
  /**
   * Run the flow and return the final output
   * @param {Object} inputs - Data to inject into input nodes
   * @param {number} timeout - Maximum execution time in milliseconds (default: 60000)
   * @returns {Promise<Object>} The final output from output nodes
   */
  async run(inputs, timeout = 60000)
  
}
```

#### Creating Instances

**Recommended: Use the static `create` method**
```javascript
const engine = await zv1.create(flow, config);
```

The static `create` method:
- Asynchronously loads all node definitions
- Loads custom type definitions  
- Loads integrations if not provided
- Returns a fully initialized zv1 instance


### Configuration Options

The `config` object supports the following properties:

```javascript
const config = {
  
  // Optional: API keys for external services
  keys: {
    openai: "sk-...",
    gemini: "...",
    // ... other service keys
  },
  
  // Optional: Node execution event handlers
  onNodeStart: async (event) => {
    // event: { nodeId, nodeType, timestamp, inputs, settings }
  },
  
  onNodeComplete: async (event) => {
    // event: { nodeId, nodeType, timestamp, inputs, outputs, settings }
  },

  onNodeUpdated: async (event) => {
    // event: { nodeId, nodeType, timestamp, data }
  },
  
  // Optional: Error event handler
  onError: async (errorEvent) => {
    // errorEvent: { errorType, message, executionId, nodeId?, nodeType?, errorDetails?, originalError? }
  },
  
  // Optional: Maximum number of plugin calls per LLM node to prevent runaway loops (default: 10)
  maxPluginCalls: 10,
  
  // Optional: Execution ID for tracking (auto-generated if not provided)
  executionId: "custom-execution-id",

  // Optional: Enable debug logging
  debug: true

};
```

### Execution Results

When you run a flow, the engine returns detailed execution information:

```javascript
const result = await engine.run(inputs);

// Example result structure:
{
  // Flow outputs (from output nodes)
  outputs: {
    data: "processed result",
    chat: [{ role: "assistant", content: "response" }]
  },
  
  // Execution timeline with detailed node information
  timeline: [
    {
      nodeId: "node-1",
      nodeType: "input-data", 
      inputs: { /* node inputs */ },
      outputs: { /* node outputs */ },
      settings: { /* node settings */ },
      startTime: "2024-01-01T10:00:00.000Z",
      endTime: "2024-01-01T10:00:00.100Z", 
      durationMs: 100,
      status: "success" // or "error"
      // errorMessage: "error details" (if status is "error")
    }
    // ... more timeline entries
  ],
  
  // Cost tracking information
  cost_summary: {
    total: 0.05,
    itemized: [
      {
        node_id: "llm-1",
        node_type: "openai-gpt-4",
        total: 0.05,
        itemized: { /* detailed cost breakdown */ }
      }
    ]
  },
  
  // Any missing input values for partial executions
  inputsMissingValues: [],
  
  // Completion message, which is also used to communicate partial runs 
  message: "Completed."
}
```

## Examples

### Basic Data Flow
```json
{
  "nodes": [
    {
      "id": "input1",
      "type": "input-data",
      "settings": { "key": "text" }
    },
    {
      "id": "process1",
      "type": "text-transform",
      "settings": { "operation": "uppercase" }
    },
    {
      "id": "output1",
      "type": "output-data"
    }
  ],
  "links": [
    {
      "from": { "node_id": "input1", "port_name": "value" },
      "to": { "node_id": "process1", "port_name": "input" }
    },
    {
      "from": { "node_id": "process1", "port_name": "output" },
      "to": { "node_id": "output1", "port_name": "value" }
    }
  ]
}
```

### Error Testing Flow
```json
{
  "flow": {
    "nodes": [
      {
        "id": "input1",
        "type": "input-data",
        "settings": { "key": "test-value" }
      },
      {
        "id": "error-test",
        "type": "self-healing-error",
        "settings": {}
      }
    ],
    "links": [
      {
        "from": { "node_id": "input1", "port_name": "value" },
        "to": { "node_id": "error-test", "port_name": "value" }
      }
    ]
  },
  "inputs": { "test-value": "Recovery Test" },
  "expectedError": {
    "type": "node",
    "message": "Self-healing error: failing 1 time(s) before success",
    "nodeId": "error-test",
    "nodeType": "self-healing-error"
  }
}
```

## License

Apache 2.0 © ZeroWidth

---

This engine is part of the zv1 platform. Visit our [documentation](https://zv1.ai/docs) for more information about the visual Workbench and other platform features.
