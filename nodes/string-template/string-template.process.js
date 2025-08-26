export default async ({inputs, settings, config}) => {

  const template = String(inputs.template || "");
  const variables = inputs.variables || {};
  const keepMissing = settings.keep_missing || false;
  
  const text = template.replace(/\{([^}]+)\}/g, (match, key) => {
    if (key in variables) {
      return String(variables[key]);
    }
    return keepMissing ? match : "";
  });
  
  return { text };
}; 