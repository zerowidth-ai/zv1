import asyncio

async def process(inputs, settings, config, nodeConfig):
  # Get delay time with safety limits
  requested_delay = max(0, float(inputs.get("delay_ms", 0)))
  max_delay = max(0, float(inputs.get("max_delay_ms", 60000)))
  actual_delay = min(requested_delay, max_delay)
  
  # Wait for the specified time
  await asyncio.sleep(actual_delay / 1000)  # Convert ms to seconds
  
  # Return the original value and the actual delay time
  return {
    "result": inputs.get("value"),
    "actual_delay_ms": actual_delay
  } 