export default async ({inputs, settings, config}) => {

  let retval = inputs.value !== undefined ? inputs.value : settings.value;

  // Ensure the value is a boolean
  retval = Boolean(retval);

  return { value: retval };
};
