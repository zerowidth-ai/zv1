export default async ({inputs, settings, config}) => {

  const input = inputs.input;

  if (typeof input !== 'boolean') {
    throw new Error("Input must be a boolean value.");
  }

  const output = !input;

  return { output };
};
