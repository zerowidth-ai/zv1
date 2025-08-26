async def process(inputs, settings, config, nodeConfig):
  text = str(inputs.get("text", ""))
  delimiter = settings.get("delimiter", " ")
  limit = int(settings.get("limit", -1))
  
  if limit > 0:
    parts = text.split(delimiter, limit)
    parts = parts[:limit]
  else:
    parts = text.split(delimiter)
    
  return {
    "parts": parts
  } 