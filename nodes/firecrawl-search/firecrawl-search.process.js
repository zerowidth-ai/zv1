export default async ({inputs, settings, config, nodeConfig}) => {
    // Get Firecrawl integration from engine
    const firecrawl = config.integrations?.firecrawl;
    if (!firecrawl) {
        throw new Error("Firecrawl integration not found");
    }

    // Build parameters
    const params = {
        query: inputs.query
    };

    // Clamp limit into Firecrawl's accepted 1-100 range
    if (inputs.limit !== null && inputs.limit !== undefined && inputs.limit !== '') {
        const limit = Number(inputs.limit);
        if (!Number.isNaN(limit)) {
            params.limit = Math.max(1, Math.min(100, Math.floor(limit)));
        }
    }

    // Make API request - let errors bubble up to be caught by error manager
    const response = await firecrawl.search(params);

    // Firecrawl v2 keys results by source ({ web: [...], news: [...], images: [...] });
    // tolerate a flat array (v1-style envelope) as well.
    const data = response.data || {};
    const rawResults = Array.isArray(data) ? data : (data.web || []);

    // Clean up the items to match the shared search-result shape
    // (title / link / displayLink / snippet) used by search nodes.
    const items = rawResults.map((result, index) => {
        let displayLink = null;
        if (result.url) {
            try {
                displayLink = new URL(result.url).hostname;
            } catch {
                displayLink = null;
            }
        }
        return {
            title: result.title || null,
            link: result.url || null,
            displayLink: displayLink,
            snippet: result.description || null,
            position: result.position !== undefined && result.position !== null ? result.position : index + 1
        };
    });

    return {
        items: items,
        total_results: items.length,
        warning: response.warning || null
    };
};
