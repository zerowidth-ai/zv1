export default async ({inputs, settings, config, nodeConfig}) => {
  const inputArray = inputs.array || [];
  
  // Handle depth parameter - convert -1 to Infinity for complete flattening
  let maxDepth;
  if (settings.depth === undefined || settings.depth === -1) {
    maxDepth = Infinity;
  } else {
    maxDepth = parseInt(settings.depth);
  }
  
  // Get other settings
  const skipEmpty = settings.skip_empty !== false;
  
  // Explicit flattening function
  function flattenArray(arr, depth) {
    // Skip empty arrays if configured
    if (skipEmpty && arr.length === 0) {
      return [];
    }
    
    // If we've reached the depth limit, don't flatten further
    if (depth <= 0 && depth !== Infinity) {
      return arr.slice();
    }
    
    let result = [];
    
    // Process each element
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      
      if (Array.isArray(item)) {
        // Skip empty arrays if configured
        if (skipEmpty && item.length === 0) {
          continue;
        }
        
        // If we still have depth to flatten
        if (depth > 0 || depth === Infinity) {
          // Recursively flatten with reduced depth
          const flattened = flattenArray(
            item, 
            depth === Infinity ? Infinity : depth - 1
          );
          // Add flattened elements to result
          result = result.concat(flattened);
        } else {
          // We've reached the depth limit, add the array as is
          result.push(item);
        }
      } else {
        // Add non-array items directly
        result.push(item);
      }
    }
    
    return result;
  }
  
  // Flatten the array with the specified depth
  const flattened = flattenArray(inputArray, maxDepth);

  return {
    array: flattened
  };
}; 