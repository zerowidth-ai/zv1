/**
 * Process function for the System Prompt node.
 * Outputs a message object, containing the prompt text and system role and text
 */
export default async ({inputs, settings, config}) => {
  // Initialize variables array if not provided
  if(!inputs.variables) {
    inputs.variables = [];
  }

  // Get the base content from settings
  let baseContent = settings.content || "";

  // Handle chain input if provided
  let chainedContent = "";
  if (inputs.chain) {
    if (typeof inputs.chain === "string") {
      chainedContent = inputs.chain;
    } else if (typeof inputs.chain === "object" && inputs.chain.content) {
      // Handle message object format
      if (Array.isArray(inputs.chain.content)) {
        // Extract text content from array format
        chainedContent = inputs.chain.content
          .filter(item => item.type === "text")
          .map(item => item.text)
          .join("\n");
      } else if (typeof inputs.chain.content === "string") {
        chainedContent = inputs.chain.content;
      }
    }
  }

  // Combine chained content with base content
  let fullContent = chainedContent ? `${chainedContent}\n\n${baseContent}` : baseContent;

  // Create message object
  let message = {
    role: "system",
    content: [
      {
        type: "text",
        text: fullContent
      }
    ]
  };

  // Process variables
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