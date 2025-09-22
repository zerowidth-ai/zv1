"""
Process function for the Get Object Property node.
Extracts a specific property value from an object by key name.
"""
from typing import Any, Dict

async def process(inputs: Dict[str, Any], settings: Dict[str, Any], config: Dict[str, Any], nodeConfig: Dict[str, Any]) -> Dict[str, Any]:
    object_input = inputs.get("object")
    key = inputs.get("key")
    default_value = settings.get("default_value")
    
    # Validate inputs
    if not isinstance(object_input, dict):
        return {
            "value": default_value,
            "exists": False,
            "key": key or ""
        }
    
    if not isinstance(key, str):
        return {
            "value": default_value,
            "exists": False,
            "key": key or ""
        }
    
    # Check if property exists
    exists = key in object_input
    value = object_input.get(key, default_value) if exists else default_value
    
    return {
        "value": value,
        "exists": exists,
        "key": key
    }
