export default async ({inputs, settings, config, nodeConfig}) => {

    try {
        // Get OpenRouter integration from engine
        const openrouter = config.integrations?.openrouter;
        if (!openrouter) {
            throw new Error("OpenRouter integration not found");
        }

        // No message processing needed for completion models

        // Build parameters object from config inputs
        const params = {};
        const configInputs = [{"name":"prompt","display_name":"Prompt","type":"string","description":"Text prompt for completion","required":true},{"name":"max_tokens","display_name":"Max Tokens","type":"number","description":"Maximum tokens to generate","default":null},{"name":"seed","display_name":"Seed","type":"number","description":"Deterministic outputs","default":null}];
        
        for (const input of configInputs) {

            if(input.name === 'messages') continue;

            const value = inputs[input.name];
            if (value !== null && value !== undefined) {
                params[input.name] = value;
            }
        }

        const response = await openrouter.chatCompletion({
            model: "openai/o1-mini",
            prompt: inputs.prompt,
            ...params
        }, nodeConfig, config);

        return {
            content: response.content,
            finish_reason: response.finish_reason,
            usage: response.usage,
            cost_total: response.cost_total,
            cost_itemized: response.cost_itemized
        };
    } catch (error) {
        console.log('error', error);
        throw new Error(`OpenAI: o1-mini node error: ${error.message}`);
    }
};