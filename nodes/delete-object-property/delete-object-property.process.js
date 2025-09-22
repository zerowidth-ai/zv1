/**
 * Process function for the Delete Object Property node.
 * Remove a specific property from an object, returning a new object without that property.
 */
export default async ({inputs, settings, config}) => {
  const { object, key } = inputs;
  
  // Validate inputs
  if (!object || typeof object !== 'object') {
    return {
      object: {},
      key: key || '',
      removed_value: null,
      was_removed: false
    };
  }
  
  if (!key || typeof key !== 'string') {
    return {
      object: object,
      key: key || '',
      removed_value: null,
      was_removed: false
    };
  }
  
  // Check if property exists
  const was_removed = key in object;
  const removed_value = was_removed ? object[key] : null;
  
  // Create new object without the property
  const newObject = { ...object };
  delete newObject[key];
  
  return {
    object: newObject,
    key: key,
    removed_value: removed_value,
    was_removed: was_removed
  };
};
