export default async ({inputs, settings, config, nodeConfig}) => {
    // Get NewsData.io integration from engine
    const newsdata = config.integrations?.newsdata_io;
    if (!newsdata) {
        throw new Error("NewsData.io integration not found");
    }

    // Process parameters with array handling
    const params = {};
    
    // Handle string inputs that can be arrays (these will be mapped by the integration)
    const arrayFields = ['countries', 'categories', 'languages'];
    
    arrayFields.forEach(field => {
        if (inputs[field] !== null && inputs[field] !== undefined) {
            params[field] = newsdata.constructor.stringToArray(inputs[field]);
        }
    });

    // Handle other parameters with snake_case to API format conversion
    const paramMappings = {
        'priority_domain': 'prioritydomain'
    };
    
    Object.entries(paramMappings).forEach(([inputKey, apiKey]) => {
        if (inputs[inputKey] !== null && inputs[inputKey] !== undefined) {
            params[apiKey] = inputs[inputKey];
        }
    });

    // Process parameters for API call
    const processedParams = newsdata.constructor.processParams(params);

    // Make API request - let errors bubble up to be caught by error manager
    const response = await newsdata.getSources(processedParams);

    return {
        sources: response.results || [],
        total_sources: response.results?.length || 0
    };
};
