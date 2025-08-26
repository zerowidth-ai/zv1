/**
 * Process function for the System Prompt node.
 * Outputs a message object, containing the prompt text and system role and text
 */
export default async ({inputs, settings, config}) => {

  // If an input value is provided, use it; otherwise use the value from settings
  let message = {
    role: "system",
    content: [
      {
        type: "text",
        text: settings.content || ""
      }
    ]
  }

  if(!inputs.variables) {
    inputs.variables = [];
  }
  
  message.content[0].text = message.content[0].text.replace(/\{\{(.*?)\}\}/g, (match, p1) => {
  
    // look for a variable with the key p1
    let variable = inputs.variables.find(variable => Object.keys(variable).find(key => key === p1));
    if(variable) {
      return variable[p1];
    }
    return match;
  });
  
  // Return the message and string prompt
  return {
    message: message,
    prompt: message.content[0].text
  };
}; 