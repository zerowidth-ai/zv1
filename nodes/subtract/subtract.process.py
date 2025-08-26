async def process(inputs, settings, config, nodeConfig):
  a = float(inputs.get("a", 0))
  b = float(inputs.get("b", 0))
  
  # Calculate the result
  result = a - b
  
  # Handle floating point precision issues
  # Convert to string with fixed precision and back to float
  result = float(format(result, '.10f'))
  
  return {
    "result": result
  } 