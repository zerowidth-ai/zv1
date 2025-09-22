export default async ({inputs, settings, config}) => {
    try {
        const input = inputs.input;
        if (!input) {
            throw new Error("Input is required for text extraction");
        }

        const includeRole = settings.include_role === true;
        const roleFormat = settings.role_format || "{role}: ";
        const separator = settings.separator || "\n\n";

        // Helper function to extract text from content
        const extractTextFromContent = (content) => {
            if (typeof content === 'string') {
                return content;
            } else if (Array.isArray(content)) {
                let text = '';
                for (const item of content) {
                    if (item && typeof item === 'object' && item.type === 'text' && item.text) {
                        text += item.text;
                    }
                }
                return text;
            } else {
                return String(content || '');
            }
        };

        // Helper function to format role prefix
        const formatRolePrefix = (role) => {
            if (!includeRole || !role) return '';
            return roleFormat.replace('{role}', role.toUpperCase());
        };

        let extractedTexts = [];
        let messageCount = 0;

        if (typeof input === 'string') {
            // Direct string input
            extractedTexts.push(input);
            messageCount = 1;
        } else if (Array.isArray(input)) {
            // Array of messages
            for (const message of input) {
                if (typeof message === 'string') {
                    // String message - no role assumption
                    extractedTexts.push(message);
                    messageCount++;
                } else if (message && typeof message === 'object' && message.content !== undefined) {
                    // Message object
                    const text = extractTextFromContent(message.content);
                    if (text.trim()) {
                        const rolePrefix = formatRolePrefix(message.role);
                        extractedTexts.push(rolePrefix + text);
                        messageCount++;
                    }
                }
            }
        } else if (input && typeof input === 'object' && input.content !== undefined) {
            // Single message object
            const text = extractTextFromContent(input.content);
            if (text.trim()) {
                const rolePrefix = formatRolePrefix(input.role);
                extractedTexts.push(rolePrefix + text);
                messageCount = 1;
            }
        } else {
            // Fallback for other types
            const text = String(input);
            extractedTexts.push(text);
            messageCount = 1;
        }

        const result = extractedTexts.join(separator);

        return {
            text: result,
            message_count: messageCount
        };

    } catch (error) {
        console.log('Extract Text Content error:', error);
        throw new Error(`Extract Text Content error: ${error.message}`);
    }
};
