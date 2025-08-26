import re

async def process(inputs, settings, config, nodeConfig):
  template = str(inputs.get("template", ""))
  variables = inputs.get("variables", {})
  keep_missing = settings.get("keep_missing", False)
  
  def replace(match):
    key = match.group(1)
    if key in variables:
      return str(variables[key])
    return match.group(0) if keep_missing else ""
  
  text = re.sub(r'\{([^}]+)\}', replace, template)
  return {
    "text": text
  } 