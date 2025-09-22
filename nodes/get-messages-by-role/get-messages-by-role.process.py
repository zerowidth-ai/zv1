from typing import Any, Dict, List, Union

async def process(inputs: Dict[str, Any], settings: Dict[str, Any], config: Dict[str, Any], nodeConfig: Dict[str, Any]) -> Dict[str, Any]:
    try:
        messages = inputs.get('messages')
        role = inputs.get('role')

        if not isinstance(messages, list):
            raise Exception("Messages input must be an array")

        if not isinstance(role, str) or not role.strip():
            raise Exception("Role must be a non-empty string")

        # Filter messages by role
        filtered_messages = [
            message for message in messages 
            if isinstance(message, dict) and message.get('role') == role
        ]

        return {
            "messages": filtered_messages,
            "count": len(filtered_messages)
        }

    except Exception as error:
        print(f'Get Messages by Role error: {error}')
        raise Exception(f"Get Messages by Role error: {str(error)}")
