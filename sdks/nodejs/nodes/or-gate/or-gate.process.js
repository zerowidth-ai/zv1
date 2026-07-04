export default async ({inputs, settings, config}) => {

  const input1 = Boolean(inputs.input1);
  const input2 = Boolean(inputs.input2);

  // OR logic
  const retval = input1 || input2;

  return { value: retval };
}; 