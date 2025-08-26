async def process(inputs, settings, config, nodeConfig):
  
  if inputs.get("input1") == True and inputs.get("input2") == True:
    return {
      "value": True
    }
  
  return {
    "value": False
  }
