export default async ({inputs, settings, config}) => {

  // Convert inputs to numbers to ensure proper comparison
  const a = Number(inputs.a);
  const b = Number(inputs.b);

  // Check if A is greater than B
  const result = a > b;

  return { result };
}; 