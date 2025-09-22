export default async ({inputs, settings, config}) => {
    try {
        const messages = inputs.messages;
        const role = inputs.role;

        if (!Array.isArray(messages)) {
            throw new Error("Messages input must be an array");
        }

        if (typeof role !== 'string' || role.trim() === '') {
            throw new Error("Role must be a non-empty string");
        }

        // Filter messages by role
        const filteredMessages = messages.filter(message => {
            return message && typeof message === 'object' && message.role === role;
        });

        return {
            messages: filteredMessages,
            count: filteredMessages.length
        };

    } catch (error) {
        console.log('Get Messages by Role error:', error);
        throw new Error(`Get Messages by Role error: ${error.message}`);
    }
};
