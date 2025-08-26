/**
 * A simple seeded random number generator based on a linear congruential generator
 * @param {number} seed - The seed value
 * @returns {function} A function that returns a random number between 0 and 1
 */
function createSeededRandom(seed) {
  // Constants for a simple Linear Congruential Generator
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  
  let currentSeed = seed;
  
  return function() {
    // Update the seed
    currentSeed = (a * currentSeed + c) % m;
    // Return a number between 0 and 1
    return currentSeed / m;
  };
}

export default async ({inputs, settings, config}) => {

  // Determine which random function to use
  let random = Math.random;
  
  // Use seeded random if a seed is provided
  if (inputs.seed !== undefined) {
    const seed = Number(inputs.seed);
    random = createSeededRandom(seed);
  }

  let value;
  const distribution = inputs.distribution || 'uniform';
  
  switch (distribution) {
    case 'normal': {
      // Box-Muller transform for normal distribution
      const mean = Number(inputs.mean) || 0;
      const stddev = Number(inputs.stddev) || 1;
      
      const u1 = random();
      const u2 = random();
      
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      value = z0 * stddev + mean;
      break;
    }
    
    case 'integer': {
      const min = Math.ceil(Number(inputs.min) || 0);
      const max = Math.floor(Number(inputs.max) || 100);
      value = Math.floor(random() * (max - min + 1)) + min;
      break;
    }
    
    case 'uniform':
    default: {
      const min = Number(inputs.min) || 0;
      const max = Number(inputs.max) || 1;
      value = random() * (max - min) + min;
      break;
    }
  }

  return { value };
}; 