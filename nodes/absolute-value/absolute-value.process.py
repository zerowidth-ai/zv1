async def process(inputs, settings, config, nodeConfig):
    output = abs(inputs["input"])
    return {"output": output}
