async def process(inputs, settings, config, nodeConfig):
  

  return {
    "tool": {
      "name": inputs.get("name", settings.get("name")),
      "description": inputs.get("description", settings.get("description")),
      "parameters": inputs.get("parameters", settings.get("parameters")),
      "strict": inputs.get("strict", settings.get("strict"))
    }
  }