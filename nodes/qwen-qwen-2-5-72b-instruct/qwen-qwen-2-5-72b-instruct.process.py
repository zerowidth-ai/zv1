async def process(inputs, settings, config, nodeConfig):
    """Process function for the Qwen2.5 72B Instruct node"""
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
        config_inputs = [{"name":"system_prompt","display_name":"System Prompt","type":"string or message","description":"System prompt for the model","default":null},{"name":"messages","display_name":"Messages","type":"array of messages or message or string","description":"Array of chat messages","required":true},{"name":"tools","display_name":"Tools","type":"tool","description":"Array of tools to use","default":null,"allow_multiple":true},{"name":"temperature","display_name":"Temperature","type":"number","description":"Controls randomness (0-2)","default":null},{"name":"max_tokens","display_name":"Max Tokens","type":"number","description":"Maximum tokens to generate","default":null},{"name":"top_p","display_name":"Top P","type":"number","description":"Controls diversity via nucleus sampling","default":null},{"name":"frequency_penalty","display_name":"Frequency Penalty","type":"number","description":"Reduces repetition (-2 to 2)","default":null},{"name":"presence_penalty","display_name":"Presence Penalty","type":"number","description":"Encourages new topics (-2 to 2)","default":null},{"name":"response_format","display_name":"Response Format","type":"string or object","description":"Output format specification","default":null},{"name":"seed","display_name":"Seed","type":"number","description":"Deterministic outputs","default":null},{"name":"stop","display_name":"Stop","type":"string or array","description":"Custom stop sequences","default":null},{"name":"tool_choice","display_name":"Tool Choice","type":"string","description":"Tool selection control","default":null}]
        
        for input_def in config_inputs:
            value = inputs.get(input_def["name"])
            if value is not None:
                params[input_def["name"]] = value

        response = await openrouter.chat_completion(
            model="qwen/qwen-2.5-72b-instruct",
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
            "logprobs": response.get("logprobs"),
            "finish_reason": response["finish_reason"],
            "usage": response["usage"]
            "cost_total": response.get("cost_total"),
            "cost_itemized": response.get("cost_itemized")
        }
    except Exception as e:
        raise Exception(f"Qwen2.5 72B Instruct node error: {str(e)}")