export default async ({inputs, settings, config}) => {
    try {
        const messages = inputs.messages;
        const filterType = inputs.filter_type;
        const filterValue = inputs.filter_value;

        if (!Array.isArray(messages)) {
            throw new Error("Messages input must be an array");
        }

        if (typeof filterType !== 'string' || filterType.trim() === '') {
            throw new Error("Filter type must be a non-empty string");
        }

        if (filterValue === undefined || filterValue === null) {
            throw new Error("Filter value is required");
        }

        const validFilterTypes = [
            'min_length', 'max_length', 'contains_text', 
            'starts_with', 'ends_with', 'role_equals', 'role_not_equals'
        ];

        if (!validFilterTypes.includes(filterType)) {
            throw new Error(`Invalid filter type: ${filterType}. Must be one of: ${validFilterTypes.join(', ')}`);
        }

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

        // Filter messages based on type
        const filteredMessages = messages.filter(message => {
            if (!message || typeof message !== 'object') return false;

            switch (filterType) {
                case 'min_length':
                    const minLength = Number(filterValue);
                    if (isNaN(minLength)) return false;
                    return getMessageText(message).length >= minLength;

                case 'max_length':
                    const maxLength = Number(filterValue);
                    if (isNaN(maxLength)) return false;
                    return getMessageText(message).length <= maxLength;

                case 'contains_text':
                    const containsText = String(filterValue).toLowerCase();
                    return getMessageText(message).toLowerCase().includes(containsText);

                case 'starts_with':
                    const startsWith = String(filterValue).toLowerCase();
                    return getMessageText(message).toLowerCase().startsWith(startsWith);

                case 'ends_with':
                    const endsWith = String(filterValue).toLowerCase();
                    return getMessageText(message).toLowerCase().endsWith(endsWith);

                case 'role_equals':
                    return message.role === filterValue;

                case 'role_not_equals':
                    return message.role !== filterValue;

                default:
                    return false;
            }
        });

        return {
            messages: filteredMessages,
            count: filteredMessages.length
        };

    } catch (error) {
        console.log('Filter Messages error:', error);
        throw new Error(`Filter Messages error: ${error.message}`);
    }
};
