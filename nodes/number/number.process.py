async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Number node.
    Outputs a constant numeric value, with optional input override.
    """
    # Use input value if provided, otherwise use the setting value
    if "value" in inputs and inputs["value"] is not None:
        value = float(inputs["value"])
    else:
        value = float(settings.get("value", 0))
    
    # Ensure the value is within min and max bounds
    min_val = float(settings.get("min", 0))
    max_val = float(settings.get("max", 100))
    
    value = max(min_val, min(max_val, value))

    return {"value": value} 