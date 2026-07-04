export default async ({inputs, settings, config}) => {

  const text = String(inputs.text || "");
  return { length: text.length };
}; 