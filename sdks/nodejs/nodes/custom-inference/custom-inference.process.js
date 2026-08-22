export default async ({inputs, settings, config, nodeConfig}) => {
    try {
        // Resolve the host-registered custom inference provider (ADR 0048
        // Phase 3). `settings.provider` names it; the host built a
        // `custom:<provider>` integration in loadIntegrations from
        // config.customInferenceProviders. `settings.model` is the model /
        // Azure deployment the endpoint serves.
        const providerName = settings?.provider;
        const model = settings?.model;
        if (!providerName || !model) {
            throw new Error("Custom Inference node requires provider + model settings");
        }
        const integration = config.integrations?.['custom:' + providerName];
        if (!integration) {
            throw new Error(`Custom inference provider "${providerName}" is not configured`);
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

        // Build parameters object from the wired inputs (everything but the
        // conversation itself), mirroring the platform LLM nodes.
        const params = {};
        for (const input of (nodeConfig?.inputs || [])) {
            if (input.name === 'messages') continue;
            const value = inputs[input.name];
            if (value !== null && value !== undefined) {
                if (input.name === 'tools' && Array.isArray(value)) {
                    params.tools = value.flat();
                } else {
                    params[input.name] = value;
                }
            }
        }

        const response = await integration.chatCompletion({
            model,
            messages,
            ...params
        }, nodeConfig, config);

        // Conversation output: keep only internal-tool history + the fresh
        // response — identical to the platform chat nodes.
        const hasInternalToolTracking = config.internal_tool_names !== undefined;
        const internalToolNames = new Set(config.internal_tool_names || []);

        let conversationMessages = [];
        if (Array.isArray(messages) && messages.length > 0) {
            for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                if (!msg || typeof msg !== 'object') continue;
                const isTool = msg.role === 'tool';
                const hasToolCalls = msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
                if (isTool) {
                    const toolName = msg.name;
                    if (!hasInternalToolTracking || internalToolNames.has(toolName)) {
                        conversationMessages.unshift(msg);
                    }
                } else if (hasToolCalls) {
                    const internalCalls = !hasInternalToolTracking
                        ? msg.tool_calls
                        : msg.tool_calls.filter(tc => internalToolNames.has(tc.function?.name));
                    if (internalCalls.length > 0) {
                        conversationMessages.unshift({ ...msg, tool_calls: internalCalls });
                    }
                } else {
                    break;
                }
            }
        }

        const finalMessage = { content: response.content, role: response.role };
        if (response.tool_calls && Array.isArray(response.tool_calls) && response.tool_calls.length > 0) {
            finalMessage.tool_calls = response.tool_calls;
        }
        if (response.images) {
            finalMessage.images = response.images;
        }
        conversationMessages.push(finalMessage);

        return {
            conversation: conversationMessages,
            message: {
                content: response.content,
                role: response.role,
                tool_calls: response.tool_calls
            },
            content: response.content,
            role: response.role,
            tool_calls: response.tool_calls,
            annotations: response.annotations,
            citations: response.citations,
            logprobs: response.logprobs,
            finish_reason: response.finish_reason,
            usage: response.usage,
            cost_total: response.cost_total,
            cost_itemized: response.cost_itemized
        };
    } catch (error) {
        throw new Error(`Custom Inference node error: ${error.message}`);
    }
};
