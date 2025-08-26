async def process(inputs, settings, config, nodeConfig):
  array = inputs.get("array", [])
  if not isinstance(array, list):
    array = [array]
    
  reversed_array = array[::-1]
  indices = list(range(len(array) - 1, -1, -1))
  
  return {
    "array": reversed_array,
    "indices": indices
  } 