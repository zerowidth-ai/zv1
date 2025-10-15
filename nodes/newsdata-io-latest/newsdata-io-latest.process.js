export default async ({inputs, settings, config, nodeConfig}) => {
    // Get NewsData.io integration from engine
    const newsdata = config.integrations?.newsdata_io;
    if (!newsdata) {
        throw new Error("NewsData.io integration not found");
    }

    // Process parameters with array handling
    const params = {};
    
    // Handle string inputs that can be arrays
    const arrayFields = [
        'countries', 'regions', 'categories', 'exclude_categories', 
        'languages', 'domains', 'exclude_domains', 'exclude_fields'
    ];
    
    arrayFields.forEach(field => {
        if (inputs[field] !== null && inputs[field] !== undefined) {
            params[field] = newsdata.constructor.stringToArray(inputs[field]);
        }
    });

    // Handle other parameters with snake_case to API format conversion
    const paramMappings = {
        'q': 'q',
        'q_in_title': 'qInTitle',
        'q_in_meta': 'qInMeta',
        'domains': 'domain',
        'categories': 'category',
        'exclude_categories': 'excludecategory',
        'languages': 'language',
        'exclude_domains': 'excludedomain',
        'exclude_fields': 'excludefield',
        'priority_domain': 'prioritydomain',
        'timeframe': 'timeframe',
        'full_content': 'full_content',
        'image': 'image',
        'video': 'video',
        'remove_duplicate': 'removeduplicate',
        'size': 'size'
    };
    
    Object.entries(paramMappings).forEach(([inputKey, apiKey]) => {
        if (inputs[inputKey] !== null && inputs[inputKey] !== undefined) {
            params[apiKey] = inputs[inputKey];
        }
    });

    // Process parameters for API call
    const processedParams = newsdata.constructor.processParams(params);
    
    // Make API request - let errors bubble up to be caught by error manager
    const response = await newsdata.getLatest(processedParams);

    return {
        articles: response.results || [],
        total_results: response.totalResults || 0,
        next_page: response.nextPage || null
    };
};
