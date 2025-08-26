# Input/Output Types Example

This example demonstrates all the different input and output node types available in zv1, showing how to handle structured data, chat messages, and text prompts.

## Flow Structure

```
input-data ──────────→ output-data (user_name_output)

input-prompt ─────────→ output-data (system_prompt_output)

input-chat ───────────→ output-chat (most recent message → formatted chat)
```

## Node Types Demonstrated

### Input Nodes
- **input-data**: Receives structured data (user_name)
- **input-chat**: Receives chat message arrays (conversation)
- **input-prompt**: Receives text prompts (system_prompt)

### Output Nodes
- **output-data**: Returns data values (demonstrates multiple data outputs)
- **output-chat**: Converts the most recent message text into a formatted chat message

## How to Run

```bash
cd zv1/sdk/engines/nodejs/examples/02-input-output-types
node run.js
```

## Expected Output

```
🔄 Running Input/Output Types Example
=====================================
📥 Input Data:
  user_name: Alice
  conversation: [
    { "role": "user", "content": "Hello there!" },
    { "role": "assistant", "content": "Hi! How can I help you today?" },
    { "role": "user", "content": "I'm learning about zv1 flows." }
  ]
  system_prompt: You are a helpful AI assistant focused on teaching.

📤 Output Results:
  user_name_output (from output-data): Alice
  system_prompt_output (from output-data): You are a helpful AI assistant focused on teaching.
  conversation_output (from output-chat): [
    {
      "content": "I'm learning about zv1 flows.",
      "role": "assistant"
    }
  ]

📊 Execution Summary:
  Total nodes executed: 6
  Execution time: 2 ms
  Status: Completed.

🎯 Input Types Processed:
  input-data: input-data-1
  input-chat: input-chat-1
  input-prompt: input-prompt-1
```

## What This Demonstrates

- **Multiple input types**: How to handle different data formats in a single flow
- **Parallel processing**: Independent data paths for different input types
- **Multiple output types**: Returning different data formats simultaneously
- **Data passthrough**: Simple input-to-output data flow
- **Flow execution tracking**: Timeline analysis and node type identification