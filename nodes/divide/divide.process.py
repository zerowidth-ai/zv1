async def process(inputs, settings, config, nodeConfig):

  # avoid division by zero 
  if inputs.get("b") == 0:
    return {
      "result": None
    }

  a = float(inputs.get("a", 0))
  b = float(inputs.get("b", 1))  # Avoid division by zero
  
  return {
    "result": a / b
  } 