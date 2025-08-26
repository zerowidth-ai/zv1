export default async ({inputs, settings, config}) => {

  const value = inputs.value;
  const failCount = parseInt(inputs.failCount) || 1;
  const errorMessage = inputs.errorMessage || `Self-healing error: failing ${failCount} time(s) before success`;
  
  // Get or initialize the execution count for this node instance
  if (!config._nodeState) {
    config._nodeState = {};
  }
  
  const nodeId = config._nodeId || 'self-healing-error';
  if (!config._nodeState[nodeId]) {
    config._nodeState[nodeId] = { executionCount: 0 };
  }
  
  const state = config._nodeState[nodeId];
  state.executionCount++;
  
  // Throw error if we haven't reached the success threshold yet
  if (state.executionCount <= failCount) {
    const error = new Error(`${errorMessage} (attempt ${state.executionCount}/${failCount + 1})`);
    error.name = 'SelfHealingError';
    error.attempt = state.executionCount;
    error.totalAttempts = failCount + 1;
    throw error;
  }
  
  // Success! Return the value
  return { result: value };
}; 