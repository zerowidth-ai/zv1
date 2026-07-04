export default async ({inputs, settings, config}) => {

  const numbers = Array.isArray(inputs.numbers) ? inputs.numbers : [inputs.numbers];
  
  // Validate all inputs are numbers
  for (const n of numbers) {
    if (n === null || n === undefined || isNaN(Number(n))) {
      throw new Error("Input contains non-numeric values that cannot be processed");
    }
  }
  
  // Convert all values to numbers
  const validNumbers = numbers.map(n => Number(n));
  
  if (validNumbers.length === 0) {
    return { 
      result: 0,
      variance: 0
    };
  }
  
  // Calculate mean
  const mean = validNumbers.reduce((sum, val) => sum + val, 0) / validNumbers.length;
  
  // Calculate variance
  const variance = validNumbers.reduce((sum, val) => {
    const diff = val - mean;
    return sum + (diff * diff);
  }, 0) / validNumbers.length;
  
  return {
    result: Math.sqrt(variance),
    variance: variance
  };
}; 