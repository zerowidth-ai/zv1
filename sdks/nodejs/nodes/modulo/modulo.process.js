export default async ({inputs, settings, config}) => {

  // Validate inputs are numbers
  const dividend = inputs.dividend;
  const divisor = inputs.divisor;
  
  if (dividend === null || dividend === undefined || isNaN(Number(dividend))) {
    throw new Error("Dividend must be a number");
  }
  
  if (divisor === null || divisor === undefined || isNaN(Number(divisor))) {
    throw new Error("Divisor must be a number");
  }
  
  const numDividend = Number(dividend);
  const numDivisor = Number(divisor);
  
  if (numDivisor === 0) {
    throw new Error("Division by zero");
  }


  let result = numDividend % numDivisor;

  // try to handle floating point division
  result = Number(result.toFixed(10));
  
  return {
    result: result
  };
}; 