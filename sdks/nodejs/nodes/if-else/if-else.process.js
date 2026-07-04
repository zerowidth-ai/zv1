export default async ({inputs, settings, config}) => {

  // Convert various truthy/falsy values to boolean
  let condition = false;
  
  if (typeof inputs.condition === 'boolean') {
    condition = inputs.condition;
  } else if (typeof inputs.condition === 'number') {
    condition = inputs.condition !== 0;
  } else if (typeof inputs.condition === 'string') {
    const lowered = inputs.condition.toLowerCase().trim();
    condition = lowered !== '' && 
                lowered !== 'false' && 
                lowered !== '0' && 
                lowered !== 'no' &&
                lowered !== 'null' &&
                lowered !== 'undefined';
  } else {
    condition = !!inputs.condition;
  }
  
  // Prepare result based on condition
  const result = condition ? inputs.if_true : inputs.if_false;
  
  // Return different outputs based on condition
  if (condition) {
    return {
      result,
      true_path: true,
      // false_path is intentionally not set
    };
  } else {
    return {
      result,
      false_path: true
      // true_path is intentionally not set
    };
  }
}; 