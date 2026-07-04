export default async ({inputs, settings, config}) => {
    try {
        const messages = inputs.messages;
        let start = inputs.start;
        let end = inputs.end;

        if (!Array.isArray(messages)) {
            throw new Error("Messages input must be an array");
        }

        if (typeof start !== 'number' || !Number.isInteger(start) || start < 0) {
            throw new Error("Start index must be a non-negative integer");
        }

        if (typeof end !== 'number' || !Number.isInteger(end)) {
            throw new Error("End index must be an integer");
        }

        // Handle -1 as end of array
        if (end === -1) {
            end = messages.length;
        }

        if (end < start) {
            throw new Error("End index must be greater than or equal to start index");
        }

        // Clamp indices to array bounds
        start = Math.max(0, Math.min(start, messages.length));
        end = Math.max(start, Math.min(end, messages.length));

        // Extract messages in range
        const rangeMessages = messages.slice(start, end);

        return {
            messages: rangeMessages,
            count: rangeMessages.length
        };

    } catch (error) {
        console.log('Get Messages Range error:', error);
        throw new Error(`Get Messages Range error: ${error.message}`);
    }
};
