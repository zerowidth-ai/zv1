export default async ({inputs, settings, config, nodeConfig}) => {
  try {
    const text = inputs.text;
    const delimiter = inputs.delimiter || settings.default_delimiter || '\n';
    const clear = inputs.clear || false;
    
    // Get current accumulated content from settings
    let currentContent = settings.accumulated_content || settings.initial_content || '';
    
    // Clear if requested
    if (clear) {
      currentContent = '';
    }
    
    // Add new text if provided
    if (text !== undefined && text !== null && text !== '') {
      if (currentContent === '') {
        // First addition, no delimiter needed
        currentContent = String(text);
      } else {
        // Subsequent additions, use delimiter
        currentContent = currentContent + delimiter + String(text);
      }
    }
    
    // Update settings to persist the accumulated content
    const outputs = {
      content: currentContent,
      length: currentContent.length,
      __updated_settings: {
        accumulated_content: currentContent
      }
    };
    
    return outputs;
    
  } catch (error) {
    throw new Error(`Text Scratch Pad error: ${error.message}`);
  }
};
