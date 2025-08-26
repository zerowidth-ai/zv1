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
      result: null,
      count: 0,
      frequency: 0
    };
  }
  
  // Count frequency of each number
  const counts = {};
  validNumbers.forEach(num => {
    counts[num] = (counts[num] || 0) + 1;
  });
  
  // Find the mode (most frequent value)
  let maxCount = 0;
  let mode = null;
  
  for (const [num, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      mode = Number(num);
    }
  }
  
  return {
    result: mode,
    count: Object.keys(counts).length,
    frequency: maxCount
  };
}; 