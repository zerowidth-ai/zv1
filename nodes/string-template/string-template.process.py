from typing import Any
import json
import re


def _render_variable(value: Any) -> str:
    """
    Render a variable value for injection into the template.
    Strings pass through untouched; everything else is JSON encoded so that
    nested objects and lists read as data instead of a Python repr.
    """
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, indent=2)
    except (TypeError, ValueError):
        # Anything JSON can't encode falls back to the default coercion
        # rather than failing the whole template.
        return str(value)


def _merge_variables(variables: Any) -> dict:
    """
    The input may arrive as a single object, or as a list of objects when it's
    fed from an "array of objects" output. Merge lists into one lookup.
    """
    if isinstance(variables, dict):
        return variables
    if not isinstance(variables, list):
        return {}
    merged = {}
    for entry in variables:
        if isinstance(entry, list):
            for item in entry:
                if isinstance(item, dict):
                    merged.update(item)
        elif isinstance(entry, dict):
            merged.update(entry)
    return merged


async def process(
    *,
    inputs: dict[str, Any],
    settings: dict[str, Any],
    config: dict[str, Any],
    node_config: dict[str, Any],
) -> dict[str, Any]:
  template = str(inputs.get("template", ""))
  variables = _merge_variables(inputs.get("variables", {}))
  keep_missing = settings.get("keep_missing", False)
  
  def replace(match):
    key = match.group(1)
    if key in variables:
      return _render_variable(variables[key])
    return match.group(0) if keep_missing else ""
  
  text = re.sub(r'\{([^}]+)\}', replace, template)
  return {
    "text": text
  }
