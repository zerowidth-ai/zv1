async def process(inputs, settings, config, nodeConfig):
  return {
    "text": f"{inputs['string_a']}{inputs['string_b']}"
  }