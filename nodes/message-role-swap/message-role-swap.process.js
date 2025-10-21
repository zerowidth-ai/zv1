export default async ({inputs, settings, config, nodeConfig}) => {
  try {
    const messages = inputs.messages;

    if (!Array.isArray(messages)) {
      throw new Error("Messages input must be an array");
    }

    const swappedMessages = [];

    for (const message of messages) {
      if (!message || typeof message !== 'object') {
        // Keep non-object messages as-is
        swappedMessages.push(message);
        continue;
      }

      // Create a copy of the message to avoid mutating the original
      const swappedMessage = { ...message };

      // Swap roles: assistant ↔ user
      if (message.role === 'assistant') {
        swappedMessage.role = 'user';
      } else if (message.role === 'user') {
        swappedMessage.role = 'assistant';
      }
      // Leave other roles (system, tool, developer) unchanged

      swappedMessages.push(swappedMessage);
    }

    return {
      messages: swappedMessages
    };

  } catch (error) {
    throw new Error(`Message Role Swap error: ${error.message}`);
  }
};
