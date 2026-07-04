export default async ({inputs, settings, config}) => {

  const value = inputs.value;
  const cases = Array.isArray(inputs.cases) ? inputs.cases : [];
  const outputs = Array.isArray(inputs.outputs) ? inputs.outputs : [];
  
  // Find matching case
  const matchIndex = cases.findIndex(caseValue => {
    // Handle different types of equality
    if (typeof value === 'number' || typeof caseValue === 'number') {
      return Number(value) === Number(caseValue);
    }
    
    if (typeof value === 'string' || typeof caseValue === 'string') {
      return String(value) === String(caseValue);
    }
    
    // Default to strict equality
    return value === caseValue;
  });
  
  // Prepare result object
  const result = {
    case_index: matchIndex,
    matched: matchIndex >= 0
  };
  
  if (matchIndex >= 0) {
    // Case matched
    result.result = outputs[matchIndex] !== undefined ? outputs[matchIndex] : value;
    
    // Add dynamic output for the matched case
    result[`case_${matchIndex}`] = true;
  } else {
    // No match, use default
    result.result = inputs.default_output;
  }
  
  return result;
}; 