/**
 * Process function for the Has Object Property node.
 * Check if an object has a specific property/key.
 */
export default async ({inputs, settings, config}) => {
  const { object, key } = inputs;
  const { check_own_properties } = settings;
  
  // Validate inputs
  if (!object || typeof object !== 'object') {
    return {
      has_property: false,
      key: key || '',
      value: null
    };
  }
  
  if (!key || typeof key !== 'string') {
    return {
      has_property: false,
      key: key || '',
      value: null
    };
  }
  
  // Check if property exists
  let has_property;
  if (check_own_properties) {
    has_property = Object.prototype.hasOwnProperty.call(object, key);
  } else {
    has_property = key in object;
  }
  
  const value = has_property ? object[key] : null;
  
  return {
    has_property: has_property,
    key: key,
    value: value
  };
};
