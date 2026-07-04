export default async ({inputs, settings, config, nodeConfig}) => {
  const value = inputs.value;
  const condition = inputs.condition;
  
  if (condition) {
    return {
      true_output: value,
      false_output: null
    };
  } else {
    return {
      true_output: null,
      false_output: value
    };
  }
};
