async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Boolean Switch node.
    """
    retval = inputs.get("value", settings.get("value", False))

    # Ensure the value is a boolean
    retval = bool(retval)

    return {"value": retval}
