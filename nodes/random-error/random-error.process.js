export default async ({inputs, settings, config}) => {

  const value = inputs.value;
  const errorProbability = parseFloat(inputs.errorProbability) || 0.1; // Default to 10% chance
  const errorMessage = inputs.errorMessage || "Random error occurred";
  const errorType = inputs.errorType || "RandomError";
  
  // Validate probability is between 0 and 1
  const probability = Math.max(0, Math.min(1, errorProbability));
  
  // Generate random number between 0 and 1
  const random = Math.random();
  
  // Throw error if random number is less than probability
  if (random < probability) {
    const error = new Error(errorMessage);
    error.name = errorType;
    error.probability = probability;
    error.randomValue = random;
    throw error;
  }
  
  // Otherwise, pass through the value
  return { result: value };
}; 