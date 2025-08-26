export default async ({inputs, settings, config}) => {

  const array = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
  const property = inputs.property || "";

  const transformed = array.map(item => {
    if (!item || typeof item !== 'object') {
      return null;
    }
    return property in item ? item[property] : null;
  });

  return {
    array: transformed
  };
}; 