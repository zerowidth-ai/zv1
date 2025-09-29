"""
Process function for the Delete Object Property node.
Remove a specific property from an object, returning a new object without that property.
"""
from typing import Any, Dict

async def process(inputs: Dict[str, Any], settings: Dict[str, Any], config: Dict[str, Any], nodeConfig: Dict[str, Any]) -> Dict[str, Any]:
    object_input = inputs.get("object")
    key = inputs.get("key")
    
    # Validate inputs
    if not isinstance(object_input, dict):
        return {
            "object": {},
            "key": key or "",
            "removed_value": None,
            "was_removed": False
        }
    
    if not isinstance(key, str):
        return {
            "object": object_input,
            "key": key or "",
            "removed_value": None,
            "was_removed": False
        }
    
    # Check if property exists
    was_removed = key in object_input
    removed_value = object_input.get(key) if was_removed else None
    
    # Create new object without the property
    new_object = object_input.copy()
    if was_removed:
        del new_object[key]
    
    return {
        "object": new_object,
        "key": key,
        "removed_value": removed_value,
        "was_removed": was_removed
    }

