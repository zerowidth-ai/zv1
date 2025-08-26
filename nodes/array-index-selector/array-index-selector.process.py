async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Array Index Selector node.
    """
    array = inputs.get("array", [])
    index = inputs.get("index", 0)

    index_to_use = index

    # Check if index is a number and round it
    if isinstance(index_to_use, (int, float)):
        index_to_use = round(index_to_use)
    
    # Safely handle array index access
    element = None
    if 0 <= index_to_use < len(array):
        element = array[index_to_use]

    # Raise an error if the element is undefined (out of bounds)
    if element is None:
        raise IndexError(f"Index {index_to_use} is out of bounds for array of length {len(array)}")

    return {"element": element}
