/**
 * Process function for the Set Object Property node.
 * Set or add a key-value pair to an object, returning a new object with the property set.
 */
export default async ({inputs, settings, config}) => {
  const { object, key, value } = inputs;
  const { overwrite } = settings;
  
  // Validate inputs - create empty object if input is null/undefined/invalid
  if (!object || typeof object !== 'object') {
    const newObject = {};
    if (key && typeof key === 'string') {
      newObject[key] = value;
    }
    return {
      object: newObject,
      key: key || '',
      value: value,
      was_new: true
    };
  }
  
  if (!key || typeof key !== 'string') {
    return {
      object: object,
      key: key || '',
      value: value,
      was_new: false
    };
  }
  
  // Check if property already exists
  const was_new = !(key in object);
  
  // If overwrite is false and property exists, don't change it
  if (!overwrite && !was_new) {
    return {
      object: object,
      key: key,
      value: object[key],
      was_new: false
    };
  }
  
  // Create new object with the property set
  const newObject = { ...object };
  newObject[key] = value;
  
  return {
    object: newObject,
    key: key,
    value: value,
    was_new: was_new
  };
};
