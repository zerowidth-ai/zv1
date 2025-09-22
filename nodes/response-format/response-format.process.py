"""
Process function for the Response Format node.
Outputs a response_format object, either from the input or from the settings.
"""
from typing import Any, Dict

async def process(inputs: Dict[str, Any], settings: Dict[str, Any], config: Dict[str, Any], nodeConfig: Dict[str, Any]) -> Dict[str, Any]:
    
    return {
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": inputs.get("name", settings.get("name")),
                "strict": inputs.get("strict", settings.get("strict")),
                "schema": inputs.get("schema", settings.get("schema"))
            }
        } 
    }
