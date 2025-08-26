async def process(inputs, settings, config, nodeConfig):
  numbers = inputs.get("numbers", [])
  if not isinstance(numbers, list):
    numbers = [numbers]
    
  # Validate all inputs are numbers
  for n in numbers:
    try:
      float(n)
    except (ValueError, TypeError):
      raise ValueError("Input contains non-numeric values that cannot be processed")
  
  # Convert all values to numbers
  valid_numbers = [float(n) for n in numbers]
  
  if not valid_numbers:
    return {"result": 0}
    
  return {
    "result": sum(valid_numbers) / len(valid_numbers)
  } 