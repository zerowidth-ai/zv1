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

        // Start from the beginning and work forwards to find messages that fit
        const result = [];
        let totalTokens = 0;
        let truncated = false;

        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            const messageTokens = countMessageTokens(message);
            
            if (totalTokens + messageTokens <= maxTokens) {
                result.push(message);
                totalTokens += messageTokens;
            } else {
                truncated = true;
                break;
            }
        }

        encoding.free();

        return {
            messages: result,
            token_count: totalTokens,
            truncated: truncated
        };

    } catch (error) {
        console.log('Truncate by Tokens from Start error:', error);
        throw new Error(`Truncate by Tokens from Start error: ${error.message}`);
    }
};
