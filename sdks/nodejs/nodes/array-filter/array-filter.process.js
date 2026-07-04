export default async ({inputs, settings, config}) => {

  const array = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
  const value = inputs.value;
  const condition = settings.condition || "equals";
  const caseSensitive = settings.case_sensitive !== false;

  const filtered = array.filter(item => {
    switch (condition) {
      case "equals":
        if (typeof item === "string" && typeof value === "string" && !caseSensitive) {
          return item.toLowerCase() === value.toLowerCase();
        }
        return item === value;
        
      case "not_equals":
        if (typeof item === "string" && typeof value === "string" && !caseSensitive) {
          return item.toLowerCase() !== value.toLowerCase();
        }
        return item !== value;
        
      case "greater_than":
        return item > value;
        
      case "less_than":
        return item < value;
        
      case "contains":
        if (typeof item === "string" && typeof value === "string") {
          return caseSensitive ? 
            item.includes(value) : 
            item.toLowerCase().includes(value.toLowerCase());
        }
        return false;
        
      case "not_contains":
        if (typeof item === "string" && typeof value === "string") {
          return caseSensitive ? 
            !item.includes(value) : 
            !item.toLowerCase().includes(value.toLowerCase());
        }
        return true;
        
      case "exists":
        return item !== null && item !== undefined;
        
      case "not_exists":
        return item === null || item === undefined;
        
      default:
        return true;
    }
  });

  return {
    array: filtered
  };
}; 