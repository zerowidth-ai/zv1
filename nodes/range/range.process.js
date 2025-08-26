export default async ({inputs, settings, config}) => {

  const numbers = Array.isArray(inputs.numbers) ? inputs.numbers : [inputs.numbers];
  const validNumbers = numbers.map(n => Number(n)).filter(n => !isNaN(n));
  
  if (validNumbers.length === 0) {
    return {
      min: 0,
      max: 0,
      range: 0
    };
  }
  
  const min = Math.min(...validNumbers);
  const max = Math.max(...validNumbers);
  
  return {
    min,
    max,
    range: max - min
  };
}; 