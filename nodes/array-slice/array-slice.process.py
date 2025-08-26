async def process(inputs, settings, config, nodeConfig):
  array = inputs.get("array", [])
  if not isinstance(array, list):
    array = [array]
    
  start = int(inputs.get("start", 0))
  end = int(inputs.get("end")) if inputs.get("end") is not None else None
  
  return {
    "array": array[start:end]
  } 