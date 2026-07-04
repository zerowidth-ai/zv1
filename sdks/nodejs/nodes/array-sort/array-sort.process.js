export default async ({inputs, settings, config}) => {

  const array = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
  const order = settings.order || "ascending";
  const type = settings.type || "string";
  const property = settings.property;
  const caseSensitive = settings.case_sensitive !== false;

  const sorted = [...array].sort((a, b) => {
    let valueA = property ? (a && a[property]) : a;
    let valueB = property ? (b && b[property]) : b;

    // Handle null/undefined values
    if (valueA == null) return 1;
    if (valueB == null) return -1;
    
    switch (type) {
      case "number":
        valueA = Number(valueA);
        valueB = Number(valueB);
        break;
        
      case "date":
        valueA = new Date(valueA).getTime();
        valueB = new Date(valueB).getTime();
        break;
        
      default: // string
        valueA = String(valueA);
        valueB = String(valueB);
        if (!caseSensitive) {
          valueA = valueA.toLowerCase();
          valueB = valueB.toLowerCase();
        }
    }

    if (valueA < valueB) return order === "ascending" ? -1 : 1;
    if (valueA > valueB) return order === "ascending" ? 1 : -1;
    return 0;
  });

  return {
    array: sorted
  };
}; 