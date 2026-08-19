/**
 * Render a variable value for injection into the template.
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
    // the default coercion rather than failing the whole template.
    return String(value);
  }
};

export default async ({inputs, settings, config}) => {

  const template = String(inputs.template || "");

  // The input may arrive as a single object, or as an array of objects when
  // it's fed from an "array of objects" output. Merge arrays into one lookup.
  const raw = inputs.variables || {};
  const variables = Array.isArray(raw)
    ? raw.reduce((acc, entry) => {
        if (Array.isArray(entry)) return Object.assign(acc, ...entry.filter(e => e && typeof e === "object"));
        if (entry && typeof entry === "object") return Object.assign(acc, entry);
        return acc;
      }, {})
    : raw;

  const keepMissing = settings.keep_missing || false;

  const text = template.replace(/\{([^}]+)\}/g, (match, key) => {
    if (key in variables) {
      return renderVariable(variables[key]);
    }
    return keepMissing ? match : "";
  });

  return { text };
};
