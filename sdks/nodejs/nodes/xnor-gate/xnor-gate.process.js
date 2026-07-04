export default async ({inputs, settings, config}) => {

  const input1 = Boolean(inputs.input1);
  const input2 = Boolean(inputs.input2);

  // XNOR logic (true if inputs are the same)
  const retval = input1 === input2;

  return { value: retval };
}; 