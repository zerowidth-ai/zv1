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
      q1: 0,
      q2: 0,
      q3: 0,
      iqr: 0
    };
  }
  
  const sorted = [...validNumbers].sort((a, b) => a - b);
  
  // Handle single value case
  if (sorted.length === 1) {
    return {
      q1: sorted[0],
      q2: sorted[0],
      q3: sorted[0],
      iqr: 0
    };
  }
  
  // Helper function to get median of an array
  const getMedian = (arr) => {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 === 0 
      ? (arr[mid - 1] + arr[mid]) / 2
      : arr[mid];
  };
  
  const mid = Math.floor(sorted.length / 2);
  const q2 = getMedian(sorted);
  
  // Calculate Q1 (median of lower half)
  const lowerHalf = sorted.slice(0, mid);
  const q1 = getMedian(lowerHalf);
  
  // Calculate Q3 (median of upper half)
  const upperHalf = sorted.slice(sorted.length % 2 ? mid + 1 : mid);
  const q3 = getMedian(upperHalf);
  
  return {
    q1,
    q2,
    q3,
    iqr: q3 - q1
  };
}; 