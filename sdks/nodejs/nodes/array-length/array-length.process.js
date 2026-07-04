export default async ({inputs, settings, config}) => {

  const array = inputs.array;

  // Initialize the length
  let length = 0;

  // Check if the input is an array and calculate its length
  if (Array.isArray(array)) {
    length = array.length;
  }

  return { length };
};
