import { encoding_for_model } from 'tiktoken';

export default async ({inputs, settings, config}) => {
    try {
        const input = inputs.input;

        // Get the tokenizer setting, default to cl200k_base
        const tokenizer = settings.tokenizer || 'cl200k_base';

        // Validate tokenizer option
        if (!['cl200k_base', 'cl100k_base'].includes(tokenizer)) {
            throw new Error(`Unsupported tokenizer: ${tokenizer}. Only cl200k_base and cl100k_base are supported.`);
        }

        // Get the encoding for the specified tokenizer
        const encoding = encoding_for_model(tokenizer === 'cl200k_base' ? 'gpt-4o' : 'gpt-4');

        let totalTokens = 0;

        // Helper function to extract text from content (handles multi-modal)
        const extractTextFromContent = (content) => {
            if (typeof content === 'string') {
                return content;
            } else if (Array.isArray(content)) {
                // Multi-modal content array - extract text from objects with type: "text"
                let text = '';
                for (const item of content) {
                    if (item && typeof item === 'object' && item.type === 'text' && item.text) {
                        text += item.text;
                    }
                }
                return text;
            } else {
                // Fallback: stringify the content
                return JSON.stringify(content);
            }
        };

        // Handle different input types
        if (typeof input === 'string') {
            // Simple string input
            totalTokens = encoding.encode(input).length;
        } else if (Array.isArray(input)) {
            // Array of messages
            for (const message of input) {
                if (typeof message === 'string') {
                    totalTokens += encoding.encode(message).length;
                } else if (message && typeof message === 'object' && message.content) {
                    // Message object with {role, content} - handle multi-modal content
                    const text = extractTextFromContent(message.content);
                    totalTokens += encoding.encode(text).length;
                }
            }
        } else if (input && typeof input === 'object' && input.content) {
            // Single message object with {role, content} - handle multi-modal content
            const text = extractTextFromContent(input.content);
            totalTokens = encoding.encode(text).length;
        } else {
            // Fallback: convert to string
            totalTokens = encoding.encode(String(input)).length;
        }

        // Free the encoding to prevent memory leaks
        encoding.free();

        return {
            tokens: totalTokens
        };

    } catch (error) {
        console.log('Token Count error:', error);
        throw new Error(`Token Count error: ${error.message}`);
    }
};
