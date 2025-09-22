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

        // Get the first N messages
        const firstMessages = messages.slice(0, count);
        const actualCount = firstMessages.length;

        return {
            messages: firstMessages,
            count: actualCount
        };

    } catch (error) {
        console.log('Get First N Messages error:', error);
        throw new Error(`Get First N Messages error: ${error.message}`);
    }
};
