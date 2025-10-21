export default async ({inputs, settings, config, nodeConfig}) => {
  const value = inputs.value;
  const condition = inputs.condition;
  
  if (condition) {
    return {
      passed: value,
      blocked: null
    };
  } else {
    return {
      passed: null,
      blocked: value
    };
  }
};
