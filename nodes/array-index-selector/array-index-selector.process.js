export default async ({inputs, settings, config}) => {

  const { array, index } = inputs;

  let indexToUse = index;

  if(typeof indexToUse === "number") {
    // Round index to nearest integer
    indexToUse = Math.round(index);
  }

  // Safely handle array index access
  const element = array[indexToUse] === undefined ? undefined : array[indexToUse];

  if(element === undefined) {
    throw new Error(`Index ${indexToUse} is out of bounds for array of length ${array.length}`);
  }

  return { element };
};
