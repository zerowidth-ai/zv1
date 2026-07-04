export default async ({inputs, settings, config}) => {

  const text = String(inputs.text || "");
  const search = String(inputs.search || "");
  
  if (!settings.case_sensitive) {
    const position = text.toLowerCase().indexOf(search.toLowerCase());
    return {
      contains: position !== -1,
      position
    };
  }
  
  const position = text.indexOf(search);
  return {
    contains: position !== -1,
    position
  };
}; 