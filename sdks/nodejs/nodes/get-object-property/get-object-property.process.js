/**
 * Process function for the Get Object Property node.
 * Extracts a specific property value from an object by key name.
 */
export default async ({inputs, settings, config}) => {
  const { object, key } = inputs;
  const { default_value } = settings;
  
  // Validate inputs
  if (!object || typeof object !== 'object') {
    return {
      value: default_value,
      exists: false,
      key: key || ''
    };
  }
  
  if (!key || typeof key !== 'string') {
    return {
      value: default_value,
      exists: false,
      key: key || ''
    };
  }
  
  // Check if property exists
  const exists = key in object;
  const value = exists ? object[key] : default_value;
  
  return {
    value: value,
    exists: exists,
    key: key
  };
};
