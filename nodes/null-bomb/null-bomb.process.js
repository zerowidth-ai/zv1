export default async ({inputs, settings, config}) => {

  const value = inputs.value;
  const nullProbability = parseFloat(inputs.nullProbability) || 0.1; // Default to 10% chance
  
  // Validate probability is between 0 and 1
  const probability = Math.max(0, Math.min(1, nullProbability));
  
  // Generate random number between 0 and 1
  const random = Math.random();
  
  // Return null/undefined if random number is less than probability
  if (random < probability) {
    // Randomly choose between null and undefined for variety
    const nullType = Math.random() < 0.5 ? null : undefined;
    return { result: nullType };
  }
  
  // Otherwise, pass through the original value
  return { result: value };
}; 