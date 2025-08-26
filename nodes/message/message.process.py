async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Message node.
    Outputs a message object, either from the input or from the settings.
    """
    # If an input value is provided, use it; otherwise use the value from settings
    message = inputs.get("message") if "message" in inputs else settings.get("message", {
        "role": "user",
        "content": "Hello, world!"
    })

    if isinstance(message, str):
        message = {
            "role": "user",
            "content": message
        }


    # if we have variables and text content, we need to replace the text content with the variables
    if message.get("content", None) and isinstance(message["content"], list) and len(message["content"]) == 1 and message["content"][0].get("type", None) == "text":
        text_content = message["content"][0]
        if text_content.get("text", None):
            text_content["text"] = text_content["text"].replace("{{", "").replace("}}", "")
    
    # Return the string value
    return {
        "message": message
    } 