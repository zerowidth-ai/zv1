export default async ({inputs, settings, config}) => {

  // Determine the output key (label input takes precedence over settings)

  let result = [];

  if(inputs.message) {
    if(Array.isArray(inputs.message)) {
      result.push(...inputs.message);
    } else {
      result.push(inputs.message);
    }
  } else if(inputs.content) {
    result.push({ content: inputs.content, role: inputs.role ?? "assistant" });
  }

  return {
    chat: result
  };
}; 