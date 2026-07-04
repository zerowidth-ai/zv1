export default async ({inputs, settings, config}) => {

  const a = Number(inputs.a) || 0;
  const b = Number(inputs.b) || 0;
  
  return {
    result: a + b
  };
}; 