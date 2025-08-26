async def process(inputs, settings, config, nodeConfig):
  base = float(inputs.get("base", 0))
  exponent = float(inputs.get("exponent", 0))
  
  return {
    "result": base ** exponent
  } 