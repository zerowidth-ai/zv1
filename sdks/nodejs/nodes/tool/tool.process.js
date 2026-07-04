/**
 * Process function for the Tool node.
 * Outputs a tool object, either from the input or from the settings.
 */
export default async ({inputs, settings, config}) => {

  
  // let tool = {
  //   type: (inputs.type !== undefined ? inputs.type : settings.type) ?? "function",
  //   function: {
  //     name: inputs.name !== undefined ? inputs.name : settings.name,
  //     description: inputs.description !== undefined ? inputs.description : settings.description,
  //     parameters: inputs.parameters !== undefined ? inputs.parameters : settings.parameters,
  //     strict: inputs.strict !== undefined ? inputs.strict : settings.strict
  //   }
  // }
  
  return {
    tool: {
      name: inputs.name !== undefined ? inputs.name : settings.name,
      description: inputs.description !== undefined ? inputs.description : settings.description,
      parameters: inputs.parameters !== undefined ? inputs.parameters : settings.parameters,
      strict: inputs.strict !== undefined ? inputs.strict : settings.strict
    } 
  };
}; 