export default async ({inputs, settings, config}) => {
    try {
        const preserveOrder = settings.preserve_order !== false;
        const filterEmpty = settings.filter_empty !== false;

        // Helper function to extract messages from input
        const extractMessages = (input) => {
            if (!input) return [];
            
            if (Array.isArray(input)) {
                return input;
            } else if (typeof input === 'object' && input.role) {
                return [input];
            } else if (typeof input === 'string') {
                // Convert string to user message
                return [{
                    role: 'user',
                    content: input
                }];
            } else {
                return [];
            }
        };

        // Helper function to filter empty messages
        const filterMessages = (messages) => {
            if (!filterEmpty) return messages;
            
            return messages.filter(message => {
                if (!message) return false;
                if (typeof message !== 'object') return false;
                if (!message.role) return false;
                if (message.content === undefined || message.content === null) return false;
                if (typeof message.content === 'string' && message.content.trim() === '') return false;
                if (Array.isArray(message.content) && message.content.length === 0) return false;
                return true;
            });
        };

        const allMessages = [];
        let inputsUsed = 0;

        // Process inputs in order (input_1 through input_8)
        const inputKeys = ['input_1', 'input_2', 'input_3', 'input_4', 'input_5', 'input_6', 'input_7', 'input_8'];
        
        for (const inputKey of inputKeys) {
            const input = inputs[inputKey];
            const messages = extractMessages(input);
            
            if (messages.length > 0) {
                const filteredMessages = filterMessages(messages);
                if (filteredMessages.length > 0) {
                    allMessages.push(...filteredMessages);
                    inputsUsed++;
                }
            }
        }

        return {
            messages: allMessages,
            message_count: allMessages.length,
            inputs_used: inputsUsed
        };

    } catch (error) {
        console.log('Message Bus error:', error);
        throw new Error(`Message Bus error: ${error.message}`);
    }
};
