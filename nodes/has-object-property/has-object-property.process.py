"""
Process function for the Has Object Property node.
Check if an object has a specific property/key.
"""
from typing import Any, Dict

async def process(inputs: Dict[str, Any], settings: Dict[str, Any], config: Dict[str, Any], nodeConfig: Dict[str, Any]) -> Dict[str, Any]:
    object_input = inputs.get("object")
    key = inputs.get("key")
    check_own_properties = settings.get("check_own_properties", True)
    
    # Validate inputs
    if not isinstance(object_input, dict):
        return {
            "has_property": False,
            "key": key or "",
            "value": None
        }
    
    if not isinstance(key, str):
        return {
            "has_property": False,
            "key": key or "",
            "value": None
        }
    
    # Check if property exists
    has_property = key in object_input
    value = object_input.get(key) if has_property else None
    
    return {
        "has_property": has_property,
        "key": key,
        "value": value
    }

