export default async ({inputs, settings, config, nodeConfig}) => {
  const number = Number(inputs.number) || 0;
  
  return {
    result: Math.abs(number)
  };
}; 