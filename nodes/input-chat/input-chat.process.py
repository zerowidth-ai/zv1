async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Input Chat node.
    Simply passes through the message.
    The engine handles individual processing due to process_individually: true
    """

    messageText = None  

    if inputs.get("messages"):
        mostRecentMessage = inputs.get("messages")[-1]
        messageText = mostRecentMessage.get("content")

        if isinstance(messageText, list):
            messageText = messageText[0].get("text")

    return {
        "messages": inputs.get("messages"),
        "message": messageText
    } 