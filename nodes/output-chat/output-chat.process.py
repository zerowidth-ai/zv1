async def process(inputs, settings, config, nodeConfig):

  result = []

  if inputs.get("message"):
    result.append(inputs.get("message"))
  elif inputs.get("content"):
    result.append({ "content": inputs.get("content"), "role": inputs.get("role") })

  return result 