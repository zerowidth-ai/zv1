async def process(inputs, settings, config, nodeConfig):
  a = float(inputs.get("a", 0))
  b = float(inputs.get("b", 0))
  
  return {
    "result": a + b
  } 