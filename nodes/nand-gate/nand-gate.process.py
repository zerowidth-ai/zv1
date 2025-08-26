async def process(inputs, settings, config, nodeConfig):
  input1 = inputs.get("input1") == True
  input2 = inputs.get("input2") == True
  
  return {
    "value": not (input1 and input2)
  } 