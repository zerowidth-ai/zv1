async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Array Builder node.
    """
    items = inputs.get("items")

    if isinstance(items, list):
        array = items
    else:
        array = [items]

    print(array)

    return {"array": array}
