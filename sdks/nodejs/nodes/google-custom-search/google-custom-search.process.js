export default async ({inputs, settings, config, nodeConfig}) => {
    // Get Google Custom Search integration from engine
    const googleSearch = config.integrations?.google_custom_search;
    if (!googleSearch) {
        throw new Error("Google Custom Search integration not found");
    }

    // Process parameters with array handling
    const params = {};
    
    // Handle string inputs that can be arrays
    const arrayFields = [
        'rights', 'excludeTerms', 'fileType'
    ];
    
    arrayFields.forEach(field => {
        if (inputs[field] !== null && inputs[field] !== undefined) {
            params[field] = googleSearch.constructor.stringToArray(inputs[field]);
        }
    });

    // Handle CX parameter - use input override or fall back to key config default
    const cx = inputs.cx || googleSearch.cx;
    if (!cx) {
        throw new Error("Custom Search Engine ID (cx) is required. Please provide it as an input or ensure your key configuration includes a default CX value.");
    }

    // Handle other parameters - no special mapping needed for Google Custom Search API
    const paramMappings = {
        'query': 'q',
        'cx': cx, // Use the resolved CX value
        'num': 'num',
        'start': 'start',
        'lr': 'lr',
        'safe': 'safe',
        'gl': 'gl',
        'cr': 'cr',
        'googlehost': 'googlehost',
        'highRange': 'highRange',
        'hl': 'hl',
        'hq': 'hq',
        'imgColorType': 'imgColorType',
        'imgDominantColor': 'imgDominantColor',
        'imgSize': 'imgSize',
        'imgType': 'imgType',
        'linkSite': 'linkSite',
        'lowRange': 'lowRange',
        'orTerms': 'orTerms',
        'relatedSite': 'relatedSite',
        'rights': 'rights',
        'searchType': 'searchType',
        'siteSearch': 'siteSearch',
        'siteSearchFilter': 'siteSearchFilter',
        'sort': 'sort',
        'exactTerms': 'exactTerms',
        'excludeTerms': 'excludeTerms',
        'fileType': 'fileType',
        'dateRestrict': 'dateRestrict'
    };
    
    Object.entries(paramMappings).forEach(([inputKey, apiKey]) => {
        if (inputs[inputKey] !== null && inputs[inputKey] !== undefined) {
            params[apiKey] = inputs[inputKey];
        }
    });

    // Special handling for siteSearchFilter - only include if siteSearch is also provided
    if (params.siteSearchFilter && !params.siteSearch) {
        delete params.siteSearchFilter;
    }

    // Process parameters for API call
    const processedParams = googleSearch.constructor.processParams(params);
    
    // Make API request - let errors bubble up to be caught by error manager
    const response = await googleSearch.search(processedParams);

    // Extract and clean data from response
    const rawItems = response.items || [];
    const searchInformation = response.searchInformation || {};
    
    // Clean up the items to remove redundancy and irrelevant data
    const items = rawItems.map(item => ({
        title: item.title,
        link: item.link,
        displayLink: item.displayLink,
        snippet: item.snippet
    }));

    return {
        items: items,
        searchInformation: searchInformation,
        totalResults: searchInformation.totalResults || "0",
        searchTime: searchInformation.searchTime || 0
    };
};
