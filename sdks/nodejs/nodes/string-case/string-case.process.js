export default async ({inputs, settings, config}) => {

  const text = String(inputs.text || "");
  const caseType = settings.case || "lower";

  switch (caseType) {
    case "upper":
      return { text: text.toUpperCase() };
    
    case "lower":
      return { text: text.toLowerCase() };
    
    case "title":
      return { 
        text: text.toLowerCase().replace(/(?:^|\s)\w/g, letter => letter.toUpperCase())
      };
    
    case "sentence":
      return {
        text: text.toLowerCase().replace(/(^\w|\.\s+\w)/g, letter => letter.toUpperCase())
      };
    
    case "camel":
      return {
        text: text.toLowerCase()
          .replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase())
      };
    
    case "snake":
      return {
        text: text.toLowerCase()
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/(^_|_$)/g, '')
      };
    
    case "kebab":
      return {
        text: text.toLowerCase()
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      };
    
    default:
      return { text };
  }
}; 