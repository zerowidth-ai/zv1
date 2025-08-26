async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Greater Than or Equal node.
    Checks if the first number is greater than or equal to the second number.
    """
    # Convert inputs to numbers to ensure proper comparison
    a = float(inputs.get("a", 0))
    b = float(inputs.get("b", 0))

    # Check if A is greater than or equal to B
    result = a >= b

    return {"result": result} 