export default async ({inputs, settings, config}) => {

  const a = inputs.a;
  const b = inputs.b;
  
  // Simple deep equality check
  const result = deepEquals(a, b);
  
  return { result };
};

// Helper function for deep equality comparison
function deepEquals(a, b) {
  // If the values are strictly equal, return true
  if (a === b) return true;
  
  // If either value is null or not an object, they're not equal
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  
  // Get the keys of both objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  // If they have different number of keys, they're not equal
  if (keysA.length !== keysB.length) return false;
  
  // Check if all keys in A exist in B and have equal values
  return keysA.every(key => keysB.includes(key) && deepEquals(a[key], b[key]));
} 