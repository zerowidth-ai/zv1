"""
Query Knowledge Base Node - Executes SQL queries against the knowledge base.
"""

from typing import Any


async def process(
    *,
    inputs: dict[str, Any],
    settings: dict[str, Any],
    config: dict[str, Any],
    node_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Process function for the Query Knowledge Base node.
    """
    # Get knowledge base integration from engine. Mirrors the JS variant:
    # a wired knowledge_base handle names a KB by uuid (per-node binding,
    # ADR 0023), falling back to the flow-global KB.
    integrations = config.get("integrations", {})
    kb_ref = inputs.get("knowledge_base")
    knowledge_base = None
    if isinstance(kb_ref, dict) and kb_ref.get("uuid"):
        knowledge_base = integrations.get(f"knowledgeBase:{kb_ref['uuid']}")
    knowledge_base = (
        knowledge_base
        or integrations.get("knowledgeBase")
        or integrations.get("sqlite")
    )

    if not knowledge_base:
        raise ValueError(
            "Knowledge base integration not found. Make sure a knowledge database is available."
        )

    query = inputs.get("query")
    params = inputs.get("params", [])
    operation = inputs.get("operation", "SELECT")

    if not query or not isinstance(query, str):
        raise ValueError("Query is required and must be a string")

    if not isinstance(params, list):
        raise ValueError("Parameters must be an array")

    # Validate operation type
    allowed_operations = ["SELECT", "INSERT", "UPDATE", "DELETE"]
    if operation.upper() not in allowed_operations:
        raise ValueError(
            f"Invalid operation type: {operation}. Must be one of: {', '.join(allowed_operations)}"
        )

    # Execute the query
    result = await knowledge_base.query(query, params, operation)

    # Cap the returned payload (mirrors the JS variant): rowCount stays
    # the true count; `truncated` flags the cut so callers can add a
    # LIMIT for the full set.
    max_rows = 1000
    data = result.get("data")
    truncated = False
    if isinstance(data, list) and len(data) > max_rows:
        data = data[:max_rows]
        truncated = True

    return {
        "data": data,
        "success": result.get("success"),
        "rowCount": result.get("rowCount"),
        "truncated": truncated,
        "operation": result.get("operation"),
        "error": None,
    }
