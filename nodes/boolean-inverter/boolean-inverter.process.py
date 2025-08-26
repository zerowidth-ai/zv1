async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Boolean Inverter node.
    """
    input_value = inputs.get("input")

    if not isinstance(input_value, bool):
        raise ValueError("Input must be a boolean value.")

    # Invert the boolean value
    output = not input_value

    return {"output": output}
