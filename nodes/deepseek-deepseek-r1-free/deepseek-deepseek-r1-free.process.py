async def process(inputs, settings, config, nodeConfig):
    """Process function for the DeepSeek: R1 (free) node"""
    try:
        # Get OpenRouter integration from engine
        openrouter = config.get("integrations", {}).get("openrouter")
        if not openrouter:
            raise Exception("OpenRouter integration not found")

        messages = inputs.get("messages", [])

        if isinstance(messages, str):
            messages = [{ "role": "user", "content": messages }]

        if isinstance(messages, dict):
            messages = [messages]

        if inputs.get("system_prompt"):
            system_prompt = inputs.get("system_prompt") 
            if isinstance(system_prompt, str):
                system_prompt = {"role": "system", "content": system_prompt}

            messages = [system_prompt, *messages]

        # Build parameters dict from config inputs
        params = {}
        config_inputs = [{"name":"system_prompt","display_name":"System Prompt","type":"string or message","description":"System prompt for the model","default":null},{"name":"messages","display_name":"Messages","type":"array of messages or message or string","description":"Array of chat messages","required":true},{"name":"temperature","display_name":"Temperature","type":"number","description":"Controls randomness (0-2)","default":null},{"name":"max_tokens","display_name":"Max Tokens","type":"number","description":"Maximum tokens to generate","default":null},{"name":"include_reasoning","display_name":"Include Reasoning","type":"boolean","description":"Include reasoning in response","default":null},{"name":"reasoning","display_name":"Reasoning","type":"boolean","description":"Internal reasoning mode","default":null}]
        
        for input_def in config_inputs:
            value = inputs.get(input_def["name"])
            if value is not None:
                params[input_def["name"]] = value

        response = await openrouter.chat_completion(
            model="deepseek/deepseek-r1:free",
            messages=messages,
            **params,
            nodeConfig=nodeConfig,
            engineConfig=config
        )

        return {
            "message": {
                "content": response["content"],
                "role": response["role"],
                "tool_calls": response.get("tool_calls")
            },
            "content": response["content"],
            "role": response["role"],
            "tool_calls": response.get("tool_calls"),
            "reasoning": response.get("reasoning"),
            "refusal": response.get("refusal"),
            "finish_reason": response["finish_reason"],
            "usage": response["usage"]
            "cost_total": response.get("cost_total"),
            "cost_itemized": response.get("cost_itemized")
        }
    except Exception as e:
        raise Exception(f"DeepSeek: R1 (free) node error: {str(e)}")