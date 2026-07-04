/**
 * Process function for the Response Format node.
 * Outputs a response_format object, either from the input or from the settings.
 */
export default async ({inputs, settings, config}) => {
  
  return {
    response_format: {
      type: "json_schema",
      json_schema: {
        name: inputs.name !== undefined ? inputs.name : settings.name,
        strict: inputs.strict !== undefined ? inputs.strict : settings.strict,
        schema: inputs.schema !== undefined ? inputs.schema : settings.schema
      }
    } 
  };
};
