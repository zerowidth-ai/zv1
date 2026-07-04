/**
 * Process function for the Message node.
 * Outputs a message object, either from the input or from the settings.
 */
export default async ({inputs, settings, config}) => {

  // If an input value is provided, use it; otherwise use the value from settings
  let message = {
    role: inputs.role !== undefined ? inputs.role : settings.role,
    content: inputs.content !== undefined ? inputs.content : settings.content
  }

  if(typeof message.content === 'string') {
    message.content = [{ type: 'text', text: message.content }];
  }

  if(!inputs.variables) {
    inputs.variables = [];
  }
  
  // if we have variables and text content, we need to replace the text content with the variables
  // do we have a text content item and what index is it
  let textContentIndex = message.content.findIndex(item => item.type === 'text');
  if(textContentIndex !== -1) {
    message.content[textContentIndex].text = message.content[textContentIndex].text.replace(/\{\{(.*?)\}\}/g, (match, p1) => {
      
      // look for a variable with the key p1
      let variable = inputs.variables.find(variable => Object.keys(variable).find(key => key === p1));
      if(variable) {
        return variable[p1];
      }
      return match;
    });
  }
  
  // Return the string value
  return {
    message: message  
  };
}; 