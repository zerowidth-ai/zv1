from typing import Any, Dict, List, Union

async def process(inputs: Dict[str, Any], settings: Dict[str, Any], config: Dict[str, Any], nodeConfig: Dict[str, Any]) -> Dict[str, Any]:
    try:
        messages = inputs.get('messages')
        count = inputs.get('count')

        if not isinstance(messages, list):
            raise Exception("Messages input must be an array")

        if not isinstance(count, int) or count < 0:
            raise Exception("Count must be a non-negative integer")

        # Get the last N messages
        last_messages = messages[-count:] if count > 0 else []
        actual_count = len(last_messages)

        return {
            "messages": last_messages,
            "count": actual_count
        }

    except Exception as error:
        print(f'Get Last N Messages error: {error}')
        raise Exception(f"Get Last N Messages error: {str(error)}")
