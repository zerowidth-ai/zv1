export default async ({inputs, settings, config}) => {

  const text = String(inputs.text || "");
  const start = parseInt(inputs.start) || 0;
  const end = inputs.end !== undefined ? parseInt(inputs.end) : undefined;
  
  return { 
    text: text.slice(start, end)
  };
}; 