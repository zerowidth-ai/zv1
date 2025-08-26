async def process(inputs, settings, config, nodeConfig):
  array = inputs.get("array", [])
  if not isinstance(array, list):
    array = [array]
  separator = str(inputs.get("separator", ","))
  
  return {
    "text": separator.join(str(x) for x in array)
  } 