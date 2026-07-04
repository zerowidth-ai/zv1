/**
 * Loop End Node
 * 
 * Decides whether to continue looping or exit based on:
 * 1. Loop iteration count vs loop_limit
 * 2. while_condition boolean flag
 * 
 * Tracks loop count internally using __updated_settings to maintain
 * state across multiple executions.
 * 
 * Outputs to either:
 * - loop_back: Send value back to loop start (continue iteration)
 * - loop_end: Final value when loop exits
 */

export default async ({ inputs, settings, config, nodeConfig }) => {
  // Get current iteration count from settings (persisted state)
  const currentIteration = (settings._loop_iteration || 0) + 1;
  
  // Get all values array from settings (persisted state)
  const allValues = settings._all_values || [];
  
  // Add current value to the array
  allValues.push(inputs.value);
  
  // Get loop control parameters
  const loopLimit = inputs.loop_limit ?? 10;
  const whileCondition = inputs.while_condition ?? true;
  
  // Determine if we should continue looping
  const shouldContinue = whileCondition && currentIteration < loopLimit;
  
  // Determine values to use for loop_back and final_value
  const loopValue = inputs.loop_value !== undefined ? inputs.loop_value : inputs.value;
  const finalValue = inputs.final_value !== undefined ? inputs.final_value : inputs.value;
  
  // Prepare outputs
  const outputs = {
    loop_back: null,
    final_value: null,
    total_iterations: null,
    all_values: null
  };
  
  if (shouldContinue) {
    // Continue looping - send loop_value back to loop start
    outputs.loop_back = loopValue;
    
    // Update internal state for next iteration
    outputs.__updated_settings = {
      _loop_iteration: currentIteration,
      _all_values: allValues
    };
  } else {
    // Exit loop - output final results
    outputs.final_value = finalValue;
    outputs.total_iterations = currentIteration;
    outputs.all_values = [...allValues]; // Return a copy of the array
    
    // Reset iteration count and values array for next loop
    outputs.__updated_settings = {
      _loop_iteration: 0,
      _all_values: []
    };
  }
  
  return outputs;
};

