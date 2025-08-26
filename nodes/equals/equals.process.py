import json

async def process(inputs, settings, config, nodeConfig):
    """
    Process function for the Equals node.
    Compares two values for equality, with deep comparison for objects and arrays.
    """
    a = inputs.get("a")
    b = inputs.get("b")
    
    # Use deep equality check
    result = deep_equals(a, b)
    
    return {"result": result}

def deep_equals(a, b):
    """Helper function for deep equality comparison"""
    # If the values are the same object, they're equal
    if a is b:
        return True
        
    # If either is None or they have different types, they're not equal
    if a is None or b is None or type(a) != type(b):
        return False
    
    # For dictionaries, compare keys and values
    if isinstance(a, dict):
        if len(a) != len(b):
            return False
        return all(k in b and deep_equals(v, b[k]) for k, v in a.items())
    
    # For lists or tuples, compare items
    if isinstance(a, (list, tuple)):
        if len(a) != len(b):
            return False
        return all(deep_equals(a[i], b[i]) for i in range(len(a)))
    
    # For other types, use standard equality
    return a == b 