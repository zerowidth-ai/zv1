/**
 * Process function for the String node.
 * Outputs a string value, either from the input or from the settings.
 */
export default async ({inputs, settings, config}) => {

  // If an input value is provided, use it; otherwise use the value from settings
  const stringValue = inputs.value !== undefined ? inputs.value : settings.value;
  
  // Return the string value
  return {
    value: stringValue
  };
}; 