async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Variable Input node.
    Requests a variable from the user via the engine.
    """

    print("SETTINGS", settings)

    # First check for an explicit value, then fall back to default_value
    value = settings.get('value')
    if value is None:
        value = settings.get('default_value')

    # If the type is select, we need to ensure the value is one of the options
    if settings.get("type") == "select" and settings.get("options"):
        options = settings["options"]
        # Handle both string and list formats for options
        if isinstance(options, str):
            options = [opt.strip() for opt in options.split(",")]
        elif isinstance(options, list):
            options = [str(opt).strip() for opt in options]
            
        if value not in options:
            raise ValueError(f"Invalid value for select variable {settings.get('key')}: {value}")

    return {
        "value": value,
        "data": {
            settings.get("key"): value
        }
    }
