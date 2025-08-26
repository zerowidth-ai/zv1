import math

async def process(inputs, settings, config, nodeConfig):
  number = float(inputs.get("number", 0))
  
  return {
    "result": math.ceil(number)
  } 