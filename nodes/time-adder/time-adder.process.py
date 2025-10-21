from datetime import datetime, timedelta
from typing import Any, Dict, List, Union

async def process(inputs: Dict[str, Any], settings: Dict[str, Any], config: Dict[str, Any], nodeConfig: Dict[str, Any]) -> Dict[str, Any]:
    try:
        base_time = inputs.get('base_time') or datetime.now().isoformat() + 'Z'
        amount = inputs.get('amount')
        unit = inputs.get('unit')
        output_format = inputs.get('output_format', 'iso')
        
        if amount is None:
            raise Exception("Amount is required")
        
        if not unit:
            raise Exception("Unit is required")
        
        # Parse base timestamp
        base_date = parse_timestamp(base_time)
        if not base_date:
            raise Exception("Invalid base timestamp format")
        
        # Create new date with added/subtracted time
        result_date = add_time(base_date, amount, unit)
        
        # Generate outputs in different formats
        iso_string = result_date.isoformat() + 'Z'
        unix_timestamp = int(result_date.timestamp())
        unix_timestamp_ms = int(result_date.timestamp() * 1000)
        
        # Format result based on requested output format
        if output_format == 'iso':
            result_time = iso_string
        elif output_format == 'unix':
            result_time = str(unix_timestamp)
        elif output_format == 'unix_ms':
            result_time = str(unix_timestamp_ms)
        elif output_format == 'rfc2822':
            result_time = result_date.strftime('%a, %d %b %Y %H:%M:%S GMT')
        else:
            result_time = iso_string
        
        return {
            'result_time': result_time,
            'iso_string': iso_string,
            'unix_timestamp': unix_timestamp,
            'unix_timestamp_ms': unix_timestamp_ms
        }
        
    except Exception as error:
        raise Exception(f"Time Adder error: {str(error)}")

def parse_timestamp(timestamp):
    """Helper function to parse various timestamp formats"""
    if not timestamp:
        return None
    
    try:
        # Try parsing as Unix timestamp (number)
        if isinstance(timestamp, (int, float)) or (isinstance(timestamp, str) and timestamp.replace('.', '').replace('-', '').isdigit()):
            num = float(timestamp)
            # If it's a large number, assume it's seconds, otherwise it might be milliseconds
            if num > 1000000000000:  # milliseconds
                return datetime.fromtimestamp(num / 1000)
            else:  # seconds
                return datetime.fromtimestamp(num)
        
        # Try parsing as ISO string or other date format
        return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except:
        return None

def add_time(date, amount, unit):
    """Helper function to add/subtract time"""
    if unit == 'seconds':
        return date + timedelta(seconds=amount)
    elif unit == 'minutes':
        return date + timedelta(minutes=amount)
    elif unit == 'hours':
        return date + timedelta(hours=amount)
    elif unit == 'days':
        return date + timedelta(days=amount)
    elif unit == 'weeks':
        return date + timedelta(weeks=amount)
    elif unit == 'months':
        # For months, we need to handle it manually since timedelta doesn't support months
        new_month = date.month + amount
        new_year = date.year
        while new_month > 12:
            new_month -= 12
            new_year += 1
        while new_month < 1:
            new_month += 12
            new_year -= 1
        return date.replace(year=new_year, month=new_month)
    elif unit == 'years':
        return date.replace(year=date.year + amount)
    else:
        raise Exception(f"Unsupported unit: {unit}")
