import random

async def process(inputs, settings, config, nodeConfig):
  array = inputs.get("array", [])
  if not isinstance(array, list):
    array = [array]
    
  seed = settings.get("seed")
  
  # Create new random instance if seed provided
  rand = random.Random(seed) if seed is not None else random.Random()
  
  # Create index mapping and shuffle together
  indices = list(range(len(array)))
  result = array.copy()
  
  # Fisher-Yates shuffle
  for i in range(len(result) - 1, 0, -1):
    j = rand.randint(0, i)
    result[i], result[j] = result[j], result[i]
    indices[i], indices[j] = indices[j], indices[i]
  
  # For empty or single-element arrays, match the expected output format
  if len(array) <= 1:
    return {
      "array": result
    }
  
  return {
    "array": result,
    "indices": indices
  } 