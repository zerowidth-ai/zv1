export default async ({inputs, settings, config}) => {

  const base = Number(inputs.base) || 0;
  const exponent = Number(inputs.exponent) || 0;
  
  return {
    result: Math.pow(base, exponent)
  };
}; 