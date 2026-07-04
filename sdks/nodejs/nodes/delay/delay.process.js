export default async ({inputs, settings, config}) => {

  // Get delay time with safety limits
  const requestedDelay = Math.max(0, Number(inputs.delay_ms) || 0);
  const maxDelay = Math.max(0, Number(inputs.max_delay_ms) || 60000);
  const actualDelay = Math.min(requestedDelay, maxDelay);
  
  // Create a promise that resolves after the delay
  await new Promise(resolve => setTimeout(resolve, actualDelay));
  
  // Return the original value and the actual delay time
  return {
    result: inputs.value,
    actual_delay_ms: actualDelay
  };
}; 