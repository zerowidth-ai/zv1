export default async ({inputs, settings, config}) => {

  
  // Use input value if provided, otherwise use the setting value
  let value = (inputs.value !== undefined && inputs.value !== null) ? Number(inputs.value) : Number(settings.value);
  
  // Ensure the value is within min and max bounds
  const min = Number(settings.min);
  const max = Number(settings.max);
  
  if (!isNaN(min) && !isNaN(max)) {
    value = Math.max(min, Math.min(max, value));
  }

  return { value };
}; 