export default async ({inputs, settings, config}) => {

  const array = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
  
  const reversed = [...array].reverse();
  const indices = array.map((_, i) => array.length - 1 - i);
  
  return {
    array: reversed,
    indices: indices
  };
}; 