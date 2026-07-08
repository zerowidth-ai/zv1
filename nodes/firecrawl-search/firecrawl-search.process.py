"""
Firecrawl Search Node - Searches the web using the Firecrawl Search API.
"""

from typing import Any
from urllib.parse import urlparse


async def process(
    *,
    inputs: dict[str, Any],
    settings: dict[str, Any],
    config: dict[str, Any],
    node_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Process function for the Firecrawl Search node.
    """
    # Get Firecrawl integration from engine
    integrations = config.get("integrations", {})
    firecrawl = integrations.get("firecrawl")

    if not firecrawl:
        raise Exception("Firecrawl integration not found")

    # Build parameters
    params: dict[str, Any] = {"query": inputs.get("query")}

    # Clamp limit into Firecrawl's accepted 1-100 range
    limit = inputs.get("limit")
    if limit is not None and limit != "":
        try:
            limit_num = int(float(limit))
            params["limit"] = max(1, min(100, limit_num))
        except (TypeError, ValueError):
            pass

    # Make API request
    response = await firecrawl.search(params)

    # Firecrawl v2 keys results by source ({"web": [...], "news": [...], "images": [...]});
    # tolerate a flat array (v1-style envelope) as well.
    data = response.get("data", {})
    raw_results = data if isinstance(data, list) else data.get("web", [])

    # Clean up the items to match the shared search-result shape
    # (title / link / displayLink / snippet) used by search nodes.
    items = []
    for index, result in enumerate(raw_results):
        url = result.get("url")
        display_link = None
        if url:
            try:
                display_link = urlparse(url).hostname
            except ValueError:
                display_link = None
        position = result.get("position")
        items.append(
            {
                "title": result.get("title"),
                "link": url,
                "displayLink": display_link,
                "snippet": result.get("description"),
                "position": position if position is not None else index + 1,
            }
        )

    return {
        "items": items,
        "total_results": len(items),
        "warning": response.get("warning"),
    }
