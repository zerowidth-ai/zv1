export default async ({inputs, settings, config}) => {

  // This node defines a variable that will be requested from the user
  // The engine will handle collecting the value when needed
  
  // Return the default value if one is set
  let value = settings.value;
  if(value === undefined) {
    value = settings.default_value;
  }
  
  if (settings.type === "select") {
    // If the type is select, we need to ensure the value is one of the options
    if (!settings.options.includes(value)) {
      throw new Error(`Invalid value for select data ${settings.key}: ${value}`);
    }
  }

  return {
    value: value,
    data: {
      [settings.key]: value
    }
  };
};
