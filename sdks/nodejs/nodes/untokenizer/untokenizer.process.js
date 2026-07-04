import { encoding_for_model } from 'tiktoken';

export default async ({inputs, settings, config}) => {
    try {
        const tokens = inputs.tokens;
        if (!Array.isArray(tokens)) {
            throw new Error("Tokens input must be an array of numbers");
        }

        // Get the tokenizer setting, default to cl200k_base
        const tokenizer = settings.tokenizer || 'cl200k_base';

        // Validate tokenizer option
        if (!['cl200k_base', 'cl100k_base'].includes(tokenizer)) {
            throw new Error(`Unsupported tokenizer: ${tokenizer}. Only cl200k_base and cl100k_base are supported.`);
        }

        // Get the encoding for the specified tokenizer
        const encoding = encoding_for_model(tokenizer === 'cl200k_base' ? 'gpt-4o' : 'gpt-4');

        // Convert to regular array if it's a Uint32Array or similar
        const tokenArray = Array.isArray(tokens) ? tokens : Array.from(tokens);

        // Validate that all tokens are numbers
        for (let i = 0; i < tokenArray.length; i++) {
            if (typeof tokenArray[i] !== 'number' || !Number.isInteger(tokenArray[i])) {
                throw new Error(`Token at index ${i} is not a valid integer: ${tokenArray[i]}`);
            }
        }

        // Decode the tokens back to text
        const decodedBytes = encoding.decode(tokenArray);
        const text = typeof decodedBytes === 'string' ? decodedBytes : new TextDecoder().decode(decodedBytes);

        // Free the encoding to prevent memory leaks
        encoding.free();

        return {
            text: text
        };

    } catch (error) {
        console.log('Untokenizer error:', error);
        throw new Error(`Untokenizer error: ${error.message}`);
    }
};
