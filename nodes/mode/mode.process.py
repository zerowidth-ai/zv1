from collections import Counter

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
    return {
      "result": None,
      "count": 0,
      "frequency": 0
    }
    
  # Count frequency of each number
  counter = Counter(valid_numbers)
  
  # Find the mode (most frequent value)
  if counter:
    mode = counter.most_common(1)[0][0]
    frequency = counter.most_common(1)[0][1]
  else:
    mode = None
    frequency = 0
    
  return {
    "result": mode,
    "count": len(counter),
    "frequency": frequency
  } 