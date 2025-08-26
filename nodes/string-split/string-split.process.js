export default async ({inputs, settings, config}) => {

  const text = String(inputs.text || "");
  const delimiter = settings.delimiter || " ";
  const limit = parseInt(settings.limit) || -1;
  
  const parts = limit > 0 ? 
    text.split(delimiter, limit) : 
    text.split(delimiter);
  
  return { parts };
}; 