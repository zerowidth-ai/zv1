async def process(inputs, settings, config, nodeConfig):
  text = str(inputs.get("text", ""))
  start = int(inputs.get("start", 0))
  end = int(inputs.get("end")) if inputs.get("end") is not None else None
  
  return {
    "text": text[start:end]
  } 