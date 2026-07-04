export default async ({inputs, settings, config}) => {

  const number = Number(inputs.number) || 0;
  
  return {
    result: Math.floor(number)
  };
}; 