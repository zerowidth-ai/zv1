async def process(inputs, settings, config, nodeConfig):
  text = str(inputs.get("text", ""))
  search = str(inputs.get("search", ""))
  
  if not settings.get("case_sensitive", True):
    text = text.lower()
    search = search.lower()
    
  position = text.find(search)
  return {
    "contains": position != -1,
    "position": position
  } 