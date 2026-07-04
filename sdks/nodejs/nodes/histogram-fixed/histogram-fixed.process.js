export default async ({inputs, settings, config}) => {

  const numbers = Array.isArray(inputs.numbers) ? inputs.numbers : [inputs.numbers];
  const validNumbers = numbers.map(n => Number(n)).filter(n => !isNaN(n));
  const start = Number(inputs.start) || 0;
  const binSize = Math.max(0.000001, Number(inputs.bin_size) || 1);
  const binCount = Math.max(1, Math.floor(Number(inputs.bin_count) || 10));
  
  // Create bin boundaries
  const bins = Array(binCount + 1).fill(0)
    .map((_, i) => start + (binSize * i));
  
  // Initialize counts
  const counts = Array(binCount).fill(0);
  let overflow = 0;
  let underflow = 0;
  
  // If we have valid numbers, count them in bins
  if (validNumbers.length > 0) {
    // Count values in each bin
    validNumbers.forEach(num => {
      if (num < start) {
        underflow++;
        return;
      }
      
      const binIndex = Math.floor((num - start) / binSize);
      if (binIndex >= binCount) {
        overflow++;
      } else {
        counts[binIndex]++;
      }
    });
  }
  
  return {
    bins,
    counts,
    overflow,
    underflow
  };
}; 