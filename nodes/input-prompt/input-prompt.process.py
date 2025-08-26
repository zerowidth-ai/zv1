async def process(inputs, settings, config, nodeConfig):
    """
    Process function to handle inputs and produce outputs.
    """
    retval = {
        "request_prompt": settings.get("prompt", "")
    }

    return retval
