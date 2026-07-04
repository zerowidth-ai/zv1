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
  
  const sum = validNumbers.reduce((acc, val) => acc + val, 0);
  return {
    result: sum / validNumbers.length
  };
}; 