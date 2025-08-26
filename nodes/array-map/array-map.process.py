import math

async def process(inputs, settings, config, nodeConfig):
  array = inputs.get("array", [])
  if not isinstance(array, list):
    array = [array]
    
  property_name = inputs.get("property", "")
  
  def extract_property(item):
    if isinstance(item, dict):
      return item.get(property_name)
    return None
    
  return {
    "array": list(map(extract_property, array))
  } 