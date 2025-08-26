export default async ({inputs, settings, config}) => {

  const array = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
  const value = inputs.value;
  const mode = settings.mode || "equals";
  const caseSensitive = settings.case_sensitive !== false;
  const property = settings.property;

  const getValue = (item) => {
    if (property && typeof item === 'object' && item !== null) {
      return item[property];
    }
    return item;
  };

  const compare = (item) => {
    const itemValue = getValue(item);
    if (itemValue == null || value == null) {
      return itemValue === value;
    }

    let stringValue = String(value);
    let stringItem = String(itemValue);
    
    if (!caseSensitive) {
      stringValue = stringValue.toLowerCase();
      stringItem = stringItem.toLowerCase();
    }

    switch (mode) {
      case "contains":
        return stringItem.includes(stringValue);
      
      case "starts_with":
        return stringItem.startsWith(stringValue);
      
      case "ends_with":
        return stringItem.endsWith(stringValue);
      
      case "regex":
        try {
          const flags = caseSensitive ? "" : "i";
          return new RegExp(stringValue, flags).test(stringItem);
        } catch {
          return false;
        }
      
      default: // equals
        return stringItem === stringValue;
    }
  };

  const index = array.findIndex(compare);
  const item = index !== -1 ? array[index] : null;

  return {
    found: index !== -1,
    item: item,
    index: index
  };
}; 