export default async ({inputs, settings, config}) => {
    try {
        const messages = inputs.messages;
        if (!Array.isArray(messages)) {
            throw new Error("Messages input must be an array");
        }

        const separator = settings.separator || " ";
        const preserveStructure = settings.preserve_structure !== false;

        if (messages.length === 0) {
            return {
                messages: [],
                original_count: 0,
                merged_count: 0,
                merges_performed: 0
            };
        }

        // Helper function to merge content
        const mergeContent = (content1, content2) => {
            if (typeof content1 === 'string' && typeof content2 === 'string') {
                return content1 + separator + content2;
            } else if (Array.isArray(content1) && Array.isArray(content2)) {
                if (preserveStructure) {
                    // Preserve multi-modal structure
                    return [...content1, ...content2];
                } else {
                    // Flatten to text
                    const text1 = content1.filter(item => item && item.type === 'text' && item.text).map(item => item.text).join('');
                    const text2 = content2.filter(item => item && item.type === 'text' && item.text).map(item => item.text).join('');
                    return text1 + separator + text2;
                }
            } else if (typeof content1 === 'string' && Array.isArray(content2)) {
                if (preserveStructure) {
                    return [{type: 'text', text: content1}, ...content2];
                } else {
                    const text2 = content2.filter(item => item && item.type === 'text' && item.text).map(item => item.text).join('');
                    return content1 + separator + text2;
                }
            } else if (Array.isArray(content1) && typeof content2 === 'string') {
                if (preserveStructure) {
                    return [...content1, {type: 'text', text: content2}];
                } else {
                    const text1 = content1.filter(item => item && item.type === 'text' && item.text).map(item => item.text).join('');
                    return text1 + separator + content2;
                }
            } else {
                // Fallback - convert to strings
                return String(content1) + separator + String(content2);
            }
        };

        const result = [];
        let mergesPerformed = 0;
        let currentMessage = null;

        for (const message of messages) {
            if (!message || typeof message !== 'object' || !message.role) {
                // Invalid message - add as-is
                if (currentMessage) {
                    result.push(currentMessage);
                    currentMessage = null;
                }
                result.push(message);
                continue;
            }

            if (!currentMessage) {
                // Start new message
                currentMessage = { ...message };
            } else if (currentMessage.role === message.role) {
                // Same role - merge content
                currentMessage.content = mergeContent(currentMessage.content, message.content);
                mergesPerformed++;
            } else {
                // Different role - finish current message and start new one
                result.push(currentMessage);
                currentMessage = { ...message };
            }
        }

        // Add the last message if there is one
        if (currentMessage) {
            result.push(currentMessage);
        }

        return {
            messages: result,
            original_count: messages.length,
            merged_count: result.length,
            merges_performed: mergesPerformed
        };

    } catch (error) {
        console.log('Merge Messages error:', error);
        throw new Error(`Merge Messages error: ${error.message}`);
    }
};
