export default async ({inputs, settings, config, nodeConfig}) => {
  const array = inputs.array || [];
  const mode = settings.mode || 'size';
  const size = parseInt(settings.size) || 2;
  let count = parseInt(settings.count);
  
  // Default count to 2 only if it's not explicitly set to 0
  if (isNaN(count)) {
    count = 2;
  }
  
  let chunks = [];
  
  if (mode === 'size') {
    // Split into chunks of specified size
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
  } else if (mode === 'count') {
    // Split into specified number of chunks
    if (count <= 0) {
      chunks = [array.slice()]; // Return the entire array as a single chunk
    } else {
      const chunkSize = Math.ceil(array.length / count);
      for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
      }
    }
  }
  
  return { chunks };
}; 