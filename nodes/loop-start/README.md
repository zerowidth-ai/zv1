# Loop Nodes - Documentation

## Overview

The loop nodes (`loop-start` and `loop-end`) enable iterative processing in flows by creating feedback loops. They demonstrate the **refiring input** capability where nodes can process multiple values over time.

## How Loops Work

```
Input → Loop-Start → Processing → Loop-End
            ↑                        ↓
            └────── loop_back ───────┘
                         │
                    loop_end → Output
```

1. **Initial trigger**: Value flows into loop-start
2. **Processing**: Value goes through processing nodes
3. **Decision point**: Loop-end decides to continue or exit
4. **Feedback**: If continuing, value goes back to loop-start (which refires)
5. **Exit**: When done, value exits via loop_end output

## Loop-Start Node

### Purpose
Entry point for loops. Receives values and passes them through. Refires on each new value.

### Inputs
- **value** (any, required, allow_multiple + refires)
  - The value to process in the loop
  - Accepts multiple values over time
  - Refires the node for each new value received

### Outputs
- **value** (any) - The current value being processed

### Behavior
- Simply passes the input value through
- Refiring is handled by the engine
- Can receive values from initial input AND loop feedback

## Loop-End Node

### Purpose
Exit point that decides whether to continue looping or exit based on iteration count and conditions.

### Inputs
- **value** (any, required) - Value to pass through or exit with
- **loop_limit** (number, optional, default: 10) - Max iterations before exit
- **loop_limit** (boolean, optional, default: true) - Continue while true

### Outputs
- **loop_back** (any) - Value sent back to loop start (null when exiting)
- **loop_end** (any) - Final value when loop exits (null when continuing)
- **iteration** (number) - Current iteration number (1-indexed)

### State Management
Uses `__updated_settings` to persist loop count between executions:
```javascript
outputs.__updated_settings = {
  _loop_iteration: currentIteration
};
```

### Exit Conditions
Loop exits when **either**:
1. `currentIteration >= loop_limit`
2. `while_condition === false`

## Example Flows

### Simple Loop (10 iterations)
```javascript
const flow = {
  nodes: [
    { id: 'input', type: 'input-data' },
    { id: 'loop_start', type: 'loop-start' },
    { id: 'loop_end', type: 'loop-end' },
    { id: 'output', type: 'output-data' }
  ],
  links: [
    { from: 'input:value', to: 'loop_start:value' },
    { from: 'loop_start:value', to: 'loop_end:value' },
    { from: 'loop_end:loop_back', to: 'loop_start:value' }, // Feedback!
    { from: 'loop_end:loop_end', to: 'output:value' }
  ]
};
```

### Counter Loop (increment 0 to 5)
```javascript
const flow = {
  nodes: [
    { id: 'zero', type: 'number', settings: { value: 0 } },
    { id: 'loop_start', type: 'loop-start' },
    { id: 'add', type: 'add', settings: { b: 1 } },
    { id: 'loop_end', type: 'loop-end' },
    { id: 'limit', type: 'number', settings: { value: 5 } },
    { id: 'output', type: 'output-data' }
  ],
  links: [
    { from: 'zero:value', to: 'loop_start:value' },
    { from: 'loop_start:value', to: 'add:a' },
    { from: 'add:result', to: 'loop_end:value' },
    { from: 'limit:value', to: 'loop_end:loop_limit' },
    { from: 'loop_end:loop_back', to: 'loop_start:value' },
    { from: 'loop_end:loop_end', to: 'output:value' }
  ]
};
// Output: final_count = 5
```

### Conditional Exit
```javascript
// Use if-else or comparison nodes to generate while_condition
// Exit when condition becomes false
```

## Implementation Notes

### Refiring Inputs
Loop-start uses `allow_multiple: true` + `refires: true` which means:
- Multiple values can connect to the input
- Node fires each time ANY connected value arrives
- Enables feedback loops where the same node processes values repeatedly

### Current Engine Support
⚠️ **Known Issue**: The current engine implementation has a bug in collecting inputs for refiring nodes (line 370 in index.js). When multiple connections exist, only the last value is used instead of collecting all values.

This works for simple loops but may need fixes for:
- Multiple parallel feedback paths
- Complex multi-input refiring scenarios

### Using the Cache History
The new array-based cache structure stores all values over time. This could enable:
- Tracking all intermediate loop values
- Debugging loop behavior
- Implementing "loop history" output
- Detecting infinite loops by monitoring value changes

### Safety Features
- **Default loop_limit**: 10 iterations prevents infinite loops
- **Max execution timeout**: Engine has 60s timeout by default
- **Duplicate execution prevention**: Uses timestamp in execution hash for refiring nodes

## Testing

Run individual node tests:
```bash
node tests/test.all-nodes.js --node loop-start
node tests/test.all-nodes.js --node loop-end
```

Run flow tests:
```bash
npm run test-flows
```

Test files:
- `loop-start.tests.json` - Basic pass-through tests
- `loop-end.tests.json` - Decision logic and state tests
- `flow.loop-simple.test.json` - Complete loop integration
- `flow.loop-counter.test.json` - Counter increment loop
- `flow.loop-early-exit.zv1` - Boolean condition exit

## Future Enhancements

Possible additions:
- **loop-break** node - Explicit break condition
- **loop-continue** node - Skip to next iteration
- **loop-accumulator** - Collect all iteration values
- **loop-index** - Expose iteration number as separate node
- **nested loops** - Loop inside loop support

