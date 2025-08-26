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
    return { result: 0 };
  }
  
  // Sort the numbers
  const sorted = [...validNumbers].sort((a, b) => a - b);
  
  // Find the median
  const mid = Math.floor(sorted.length / 2);
  const result = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  
  return { result };
}; 