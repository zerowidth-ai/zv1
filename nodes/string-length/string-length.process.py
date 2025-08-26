async def process(inputs, settings, config, nodeConfig):
  text = str(inputs.get("text", ""))
  return {
    "length": len(text)
  } 