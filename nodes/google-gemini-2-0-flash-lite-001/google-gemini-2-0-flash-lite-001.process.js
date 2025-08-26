export default async ({inputs, settings, config, nodeConfig}) => {

    try {
        // Get OpenRouter integration from engine
        const openrouter = config.integrations?.openrouter;
        if (!openrouter) {
            throw new Error("OpenRouter integration not found");
        }

        let messages = inputs.messages;

        if(typeof messages === 'string') {
            messages = [{ role: 'user', content: messages }];
        }

        if(typeof messages === 'object' && !Array.isArray(messages)) {
            messages = [messages];
        }

        if(inputs.system_prompt) {  
            let systemPrompt = inputs.system_prompt;
            if(typeof systemPrompt === 'string') {
                systemPrompt = { role: 'system', content: systemPrompt };
            }
            messages = [systemPrompt, ...messages];
        }

        // Build parameters object from config inputs
        const params = {};
        const configInputs = [{"name":"system_prompt","display_name":"System Prompt","type":"string or message","description":"System prompt for the model","default":null},{"name":"messages","display_name":"Messages","type":"array of messages or message or string","description":"Array of chat messages","required":true},{"name":"tools","display_name":"Tools","type":"tool","description":"Array of tools to use","default":null,"allow_multiple":true},{"name":"temperature","display_name":"Temperature","type":"number","description":"Controls randomness (0-2)","default":null},{"name":"max_tokens","display_name":"Max Tokens","type":"number","description":"Maximum tokens to generate","default":null},{"name":"top_p","display_name":"Top P","type":"number","description":"Controls diversity via nucleus sampling","default":null},{"name":"response_format","display_name":"Response Format","type":"string or object","description":"Output format specification","default":null},{"name":"seed","display_name":"Seed","type":"number","description":"Deterministic outputs","default":null},{"name":"stop","display_name":"Stop","type":"string or array","description":"Custom stop sequences","default":null},{"name":"structured_outputs","display_name":"Structured Outputs","type":"string or object","description":"JSON schema enforcement","default":null},{"name":"tool_choice","display_name":"Tool Choice","type":"string","description":"Tool selection control","default":null}];
        
        for (const input of configInputs) {

            if(input.name === 'messages') continue;

            const value = inputs[input.name];
            if (value !== null && value !== undefined) {
                params[input.name] = value;
            }
        }

        const response = await openrouter.chatCompletion({
            model: "google/gemini-2.0-flash-lite-001",
            messages: messages,
            ...params
        }, nodeConfig, config);

        return {
            message: {
                content: response.content,
                role: response.role,
                tool_calls: response.tool_calls
            },
            content: response.content,
            role: response.role,
            tool_calls: response.tool_calls,
            finish_reason: response.finish_reason,
            usage: response.usage,
            cost_total: response.cost_total,
            cost_itemized: response.cost_itemized
        };
    } catch (error) {
        console.log('error', error);
        throw new Error(`Google: Gemini 2.0 Flash Lite node error: ${error.message}`);
    }
};