async def process(inputs, settings, config, nodeConfig):
    """Process function for the Perplexity: Sonar Pro node"""
    try:
        # Get OpenRouter integration from engine
        openrouter = config.get("integrations", {}).get("openrouter")
        if not openrouter:
            raise Exception("OpenRouter integration not found")

        # No message processing needed for completion models

        # Build parameters dict from config inputs
        params = {}
        config_inputs = [{"name":"prompt","display_name":"Prompt","type":"string","description":"Text prompt for completion","required":true},{"name":"temperature","display_name":"Temperature","type":"number","description":"Controls randomness (0-2)","default":null},{"name":"max_tokens","display_name":"Max Tokens","type":"number","description":"Maximum tokens to generate","default":null},{"name":"top_p","display_name":"Top P","type":"number","description":"Controls diversity via nucleus sampling","default":null},{"name":"frequency_penalty","display_name":"Frequency Penalty","type":"number","description":"Reduces repetition (-2 to 2)","default":null},{"name":"presence_penalty","display_name":"Presence Penalty","type":"number","description":"Encourages new topics (-2 to 2)","default":null}]
        
        for input_def in config_inputs:
            value = inputs.get(input_def["name"])
            if value is not None:
                params[input_def["name"]] = value

        response = await openrouter.chat_completion(
            model="perplexity/sonar-pro",
            prompt=inputs.get("prompt"),
            **params,
            nodeConfig=nodeConfig,
            engineConfig=config
        )

        return {
            "content": response["content"],
            "annotations": response.get("annotations"),
            "citations": response.get("citations"),
            "finish_reason": response["finish_reason"],
            "usage": response["usage"]
            "cost_total": response.get("cost_total"),
            "cost_itemized": response.get("cost_itemized")
        }
    except Exception as e:
        raise Exception(f"Perplexity: Sonar Pro node error: {str(e)}")