export default async ({inputs, settings, config}) => {

  const array = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
  const mode = settings.mode || "value";
  const property = settings.property;
  const caseSensitive = settings.case_sensitive !== false;

  const getCompareValue = (item) => {
    let value = item;
    
    if (mode === "property" && property && typeof item === 'object' && item !== null) {
      value = item[property];
    }
    
    if (mode === "json") {
      try {
        // Sort keys to ensure consistent ordering for object comparison
        return JSON.stringify(item, Object.keys(item).sort());
      } catch {
        return String(item);
      }
    }
    
    if (typeof value === 'string' && !caseSensitive) {
      return value.toLowerCase();
    }
    
    return value;
  };

  const seen = new Map();
  const duplicates = [];
  const indices = [];
  
  array.forEach((item, index) => {
    const compareValue = getCompareValue(item);
    if (!seen.has(compareValue)) {
      seen.set(compareValue, {item, index});
    } else {
      duplicates.push(item);
    }
  });

  const unique = Array.from(seen.values()).map(({item, index}) => {
    indices.push(index);
    return item;
  });

  return {
    array: unique,
    count: unique.length,
    duplicates: duplicates,
    indices: indices
  };
}; 