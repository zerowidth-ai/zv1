export default async ({inputs, settings, config}) => {

  const array = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
  const separator = inputs.separator !== undefined ? String(inputs.separator) : ",";
  
  return {
    text: array.join(separator)
  };
}; 