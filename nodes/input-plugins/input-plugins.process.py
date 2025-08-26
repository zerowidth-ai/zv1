async def process(inputs, settings, config, nodeConfig):
    """
    This node simply returns the tools array injected by the engine.
    The engine should set settings['tools'] to the array of tool schemas/runners.
    """
    return {
        "tools": settings.get("tools", [])
    }
