export default async ({inputs, settings, config}) => {
    try {
        const messages = inputs.messages;
        const count = inputs.count;

        if (!Array.isArray(messages)) {
            throw new Error("Messages input must be an array");
        }

        if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
            throw new Error("Count must be a non-negative integer");
        }

        // Get the last N messages
        const lastMessages = count === 0 ? [] : messages.slice(-count);
        const actualCount = lastMessages.length;

        return {
            messages: lastMessages,
            count: actualCount
        };

    } catch (error) {
        console.log('Get Last N Messages error:', error);
        throw new Error(`Get Last N Messages error: ${error.message}`);
    }
};
