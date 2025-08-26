export default async ({inputs, settings, config}) => {

  const text = String(inputs.text || "");
  const search = String(inputs.search || "");
  const replacement = String(inputs.replacement || "");
  
  if (settings.regex) {
    const flags = settings.case_sensitive ? 'g' : 'gi';
    const regex = new RegExp(search, flags);
    return { text: text.replace(regex, replacement) };
  }
  
  if (!settings.case_sensitive) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return { text: text.replace(regex, replacement) };
  }
  
  return { text: text.replaceAll(search, replacement) };
}; 