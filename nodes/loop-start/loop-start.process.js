/**
 * Loop Start Node
 * 
 * Entry point for loops - receives values and passes them through.
 * Refires on each new value received, enabling iterative processing.
 * 
 * This node acts as a receiver for loop feedback, allowing values to
 * circulate through a loop structure multiple times.
 */

export default async ({ inputs, settings, config, nodeConfig }) => {
  // Simply pass through the value
  // The refiring behavior is handled by the engine
  return {
    value: inputs.value
  };
};

