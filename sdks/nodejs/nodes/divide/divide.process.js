export default async ({inputs, settings, config}) => {


  // avoid division by zero 
  if (inputs.b === 0) {
    return {
      result: null
    };
  }

  const a = Number(inputs.a) || 0;
  const b = Number(inputs.b) || 1; // Avoid division by zero
  
  
  return {
    result: a / b
  };
}; 