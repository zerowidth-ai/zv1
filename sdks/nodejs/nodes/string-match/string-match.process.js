export default async ({inputs, settings, config}) => {

  const text = String(inputs.text || "");
  const pattern = String(inputs.pattern || "");
  
  try {
    const flags = (settings.case_sensitive ? "" : "i") + (settings.global ? "g" : "");
    const regex = new RegExp(pattern, flags);
    
    if (settings.global) {
      const matches = Array.from(text.matchAll(regex));
      return {
        matched: matches.length > 0,
        matches: matches.map(m => m[0]),
        groups: matches.length > 0 ? matches[0].slice(1) : []
      };
    } else {
      const match = text.match(regex);
      return {
        matched: match !== null,
        matches: match ? [match[0]] : [],
        groups: match ? match.slice(1) : []
      };
    }
  } catch (e) {
    return {
      matched: false,
      matches: [],
      groups: []
    };
  }
}; 