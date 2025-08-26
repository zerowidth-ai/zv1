export default async ({inputs, settings, config}) => {

  const array = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
  const start = inputs.start !== undefined ? parseInt(inputs.start) : 0;
  const end = inputs.end !== undefined ? parseInt(inputs.end) : undefined;
  
  return {
    array: array.slice(start, end)
  };
}; 