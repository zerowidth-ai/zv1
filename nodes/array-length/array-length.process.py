async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Array Length node.
    """
    array = inputs.get("array", [])

    # Default length to 0 if not an array
    length = 0

    # Check if the input is an array and calculate its length
    if isinstance(array, list):
        length = len(array)

    return {"length": length}
