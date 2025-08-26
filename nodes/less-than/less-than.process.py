async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Less Than node.
    Checks if the first number is less than the second number.
    """
    # Convert inputs to numbers to ensure proper comparison
    a = float(inputs.get("a", 0))
    b = float(inputs.get("b", 0))

    # Check if A is less than B
    result = a < b

    return {"result": result} 