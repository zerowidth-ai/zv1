import json

async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the JSON Parser node.
    Parses a JSON string into an object or array.
    """
    json_string = inputs.get("json", "")
    value = None
    error = ""
    success = False
    
    try:
        value = json.loads(json_string)
        success = True
        
        # For successful parsing, include all fields
        return {
            "value": value,
            "error": error,
            "success": success
        }
    except Exception as e:
        error = str(e)
        
        # Try to parse the default value
        try:
            value = json.loads(settings.get("default_value", "{}"))
        except:
            value = {}
        
        # For failed parsing, only include value and success fields
        # This matches the expected output format in the tests
        return {
            "value": value,
            "success": success
        } 