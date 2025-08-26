export default async ({inputs, settings, config}) => {

  const a = Number(inputs.a) || 0;
  const b = Number(inputs.b) || 0;


  // try to handle floating point subtraction
  let result = a - b;

  result = Number(result.toFixed(10));
  
  return {
    result: result
  };
}; 