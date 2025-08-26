export default async ({inputs, settings, config}) => {

  const numbers = Array.isArray(inputs.numbers) ? inputs.numbers : [inputs.numbers];
  
  // Validate that we have valid numbers to work with
  const validNumbers = numbers
    .map(n => {
      const num = Number(n);
      return isNaN(num) ? null : num;
    })
    .filter(n => n !== null);
  
  // Check if we lost any values during validation
  if (validNumbers.length !== numbers.length) {
    throw new Error("Input contains non-numeric values that cannot be processed");
  }
  
  const numBins = Math.max(1, Math.floor(Number(inputs.bins) || 10));
  
  if (validNumbers.length === 0) {
    return {
      bins: [],
      counts: []
    };
  }
  
  // Calculate bin boundaries
  const min = Math.min(...validNumbers);
  const max = Math.max(...validNumbers);
  
  // Handle the case where all values are the same
  if (min === max) {
    // Create bins array with the same value repeated
    const bins = Array(numBins + 1).fill(min);
    // Put all values in the first bin
    const counts = Array(numBins).fill(0);
    counts[0] = validNumbers.length;
    
    return {
      bins,
      counts
    };
  }
  
  const binWidth = (max - min) / numBins;
  
  // Create bin boundaries with fixed precision to avoid floating point errors
  const bins = Array(numBins + 1).fill(0)
    .map((_, i) => {
      // Round to 10 decimal places to avoid floating point errors
      return Number((min + (binWidth * i)).toFixed(10));
    });
  
  // Initialize counts array
  const counts = Array(numBins).fill(0);
  
  // Count values in each bin
  validNumbers.forEach(num => {
    // Handle edge case for maximum value
    if (num === max) {
      counts[counts.length - 1]++;
      return;
    }
    
    const binIndex = Math.floor((num - min) / binWidth);
    counts[binIndex]++;
  });
  
  return {
    bins,
    counts
  };
}; 