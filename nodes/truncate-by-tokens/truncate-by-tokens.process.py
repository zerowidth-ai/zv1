import tiktoken
from typing import Any, Dict, List, Union

async def process(inputs: Dict[str, Any], settings: Dict[str, Any], config: Dict[str, Any], nodeConfig: Dict[str, Any]) -> Dict[str, Any]:
    try:
        messages = inputs.get('messages')
        max_tokens = inputs.get('max_tokens')

        if not isinstance(messages, list):
            raise Exception("Messages input must be an array")

        if not isinstance(max_tokens, int) or max_tokens < 0:
            raise Exception("Max tokens must be a non-negative integer")

        tokenizer = settings.get('tokenizer', 'cl200k_base')
        if tokenizer not in ['cl200k_base', 'cl100k_base']:
            raise Exception(f"Unsupported tokenizer: {tokenizer}. Only cl200k_base and cl100k_base are supported.")

        encoding_name = 'cl200k_base' if tokenizer == 'cl200k_base' else 'cl100k_base'
        encoding = tiktoken.get_encoding(encoding_name)

        # Helper function to extract text content from message
        def get_message_text(message):
            if not isinstance(message, dict):
                return ''
            content = message.get('content', '')
            if isinstance(content, str):
                return content
            elif isinstance(content, list):
                text_parts = []
                for item in content:
                    if isinstance(item, dict) and item.get('type') == 'text' and 'text' in item:
                        text_parts.append(item['text'])
                return ' '.join(text_parts)
            else:
                return str(content)

        # Helper function to count tokens in a message
        def count_message_tokens(message):
            text = get_message_text(message)
            return len(encoding.encode(text))

        # Start from the end and work backwards to find messages that fit
        result = []
        total_tokens = 0
        truncated = False

        for i in range(len(messages) - 1, -1, -1):
            message = messages[i]
            message_tokens = count_message_tokens(message)
            
            if total_tokens + message_tokens <= max_tokens:
                result.insert(0, message)  # Add to beginning to maintain order
                total_tokens += message_tokens
            else:
                truncated = True
                break

        return {
            "messages": result,
            "token_count": total_tokens,
            "truncated": truncated
        }

    except Exception as error:
        print(f'Truncate by Tokens error: {error}')
        raise Exception(f"Truncate by Tokens error: {str(error)}")
