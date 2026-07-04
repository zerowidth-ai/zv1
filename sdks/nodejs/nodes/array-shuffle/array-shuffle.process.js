export default async ({inputs, settings, config}) => {

  const array = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
  const seed = settings.seed;
  
  // Fisher-Yates shuffle with optional seeded random
  const shuffle = (arr) => {
    const result = [...arr];
    const indices = arr.map((_, i) => i);
    
    // Seeded random number generator
    const random = (() => {
      if (seed === undefined) return Math.random;
      
      let value = Number(seed);
      return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
      };
    })();
    
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    return { result, indices };
  };
  
  const { result, indices } = shuffle(array);
  
  return {
    array: result,
    indices: indices
  };
}; 