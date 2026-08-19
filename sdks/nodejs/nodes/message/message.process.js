/**
 * Process function for the Message node.
 * Outputs a message object, either from the input or from the settings.
 */
/**
 * Render a variable value for injection into message text.
 * Strings pass through untouched; everything else is JSON encoded so that
 * nested objects and arrays read as data instead of "[object Object]".
 */
const renderVariable = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    // Circular structures (or anything else JSON can't encode) fall back to
    // the default coercion rather than failing the whole message.
    return String(value);
  }
};

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

  // A single connection can deliver an array of key-value objects, so flatten
  // one level before looking keys up.
  const variables = (Array.isArray(inputs.variables) ? inputs.variables : [inputs.variables])
    .flatMap(entry => Array.isArray(entry) ? entry : [entry])
    .filter(entry => entry !== null && typeof entry === "object");
  
  // if we have variables and text content, we need to replace the text content with the variables
  // do we have a text content item and what index is it
  let textContentIndex = message.content.findIndex(item => item.type === 'text');
  if(textContentIndex !== -1) {
    message.content[textContentIndex].text = message.content[textContentIndex].text.replace(/\{\{(.*?)\}\}/g, (match, p1) => {
      
      // look for a variable with the key p1
      let variable = variables.find(variable => Object.keys(variable).find(key => key === p1));
      if(variable) {
        return renderVariable(variable[p1]);
      }
      return match;
    });
  }
  
  // Return the string value
  return {
    message: message  
  };
}; 