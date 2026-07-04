export default async ({inputs, settings, config}) => {

  const text = String(inputs.text || "");
  const chars = inputs.chars;
  const mode = settings.mode || "both";

  // If specific characters are provided, use them for trimming
  if (chars) {
    const regex = new RegExp(`^[${chars}]+|[${chars}]+$`, mode === "start" ? "^" : mode === "end" ? "$" : "g");
    return { text: text.replace(regex, "") };
  }

  // Otherwise use standard whitespace trimming
  switch (mode) {
    case "start":
      return { text: text.trimStart() };
    case "end":
      return { text: text.trimEnd() };
    default:
      return { text: text.trim() };
  }
}; 