import { encoding_for_model } from 'tiktoken';

export default async ({inputs, settings, config}) => {
    try {
        const messages = inputs.messages;
        const maxTokens = inputs.max_tokens;

        if (!Array.isArray(messages)) {
            throw new Error("Messages input must be an array");
        }

        if (typeof maxTokens !== 'number' || maxTokens < 0 || !Number.isInteger(maxTokens)) {
            throw new Error("Max tokens must be a non-negative integer");
        }

        const tokenizer = settings.tokenizer || 'cl200k_base';
        if (!['cl200k_base', 'cl100k_base'].includes(tokenizer)) {
            throw new Error(`Unsupported tokenizer: ${tokenizer}. Only cl200k_base and cl100k_base are supported.`);
        }

        const countSystem = settings.count_system === true; // Default to false

        const encoding = encoding_for_model(tokenizer === 'cl200k_base' ? 'gpt-4o' : 'gpt-4');

        // Helper function to extract text content from message
        const getMessageText = (message) => {
            if (!message || typeof message !== 'object') return '';
            if (typeof message.content === 'string') return message.content;
            if (Array.isArray(message.content)) {
                return message.content
                    .filter(item => item && item.type === 'text' && item.text)
                    .map(item => item.text)
                    .join(' ');
            }
            return String(message.content || '');
        };

        // Helper function to count tokens in a message
        const countMessageTokens = (message) => {
            const text = getMessageText(message);
            return encoding.encode(text).length;
        };

        // Separate system and non-system messages
        const systemMessages = [];
        const nonSystemMessages = [];

        for (const message of messages) {
            if (message && typeof message === 'object' && message.role === 'system') {
                systemMessages.push(message);
            } else {
                nonSystemMessages.push(message);
            }
        }

        // Count tokens in system messages
        let systemTokens = 0;
        for (const message of systemMessages) {
            systemTokens += countMessageTokens(message);
        }

        // Handle system messages based on count_system setting
        const result = [];
        let totalTokens = 0;
        let truncated = false;

        if (maxTokens === 0) {
            // Zero token limit - don't include any messages
            truncated = systemMessages.length > 0 || nonSystemMessages.length > 0;
        } else if (countSystem) {
            // System messages count toward limit - only include if they fit
            if (systemTokens <= maxTokens) {
                result.push(...systemMessages);
                totalTokens = systemTokens;
            } else {
                // System messages exceed limit - don't include them
                truncated = systemMessages.length > 0;
            }
        } else {
            // System messages don't count toward limit - always include them
            result.push(...systemMessages);
            totalTokens = systemTokens;
            if (systemTokens > maxTokens) {
                truncated = true;
            }
        }

        // Only process non-system messages if we have room and token limit > 0
        if (maxTokens > 0 && (systemTokens <= maxTokens || !countSystem)) {
            for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
                const message = nonSystemMessages[i];
                const messageTokens = countMessageTokens(message);
                
                if (totalTokens + messageTokens <= maxTokens) {
                    result.push(message);
                    totalTokens += messageTokens;
                } else {
                    truncated = true;
                    break;
                }
            }
        } else if (maxTokens > 0 && systemTokens > maxTokens && countSystem) {
            // System messages exceed limit and count_system is true, so non-system messages are truncated
            truncated = nonSystemMessages.length > 0;
        }

        // Sort result to maintain original order (system messages first, then others)
        result.sort((a, b) => {
            const aIndex = messages.indexOf(a);
            const bIndex = messages.indexOf(b);
            return aIndex - bIndex;
        });

        encoding.free();

        // Count system messages in the result
        const resultSystemCount = result.filter(msg => msg && msg.role === 'system').length;

        return {
            messages: result,
            token_count: totalTokens,
            truncated: truncated,
            system_count: resultSystemCount
        };

    } catch (error) {
        console.log('Truncate by Tokens Preserve System error:', error);
        throw new Error(`Truncate by Tokens Preserve System error: ${error.message}`);
    }
};
