export default async ({inputs, settings, config, nodeConfig}) => {
    // Get Firecrawl integration from engine
    const firecrawl = config.integrations?.firecrawl;
    if (!firecrawl) {
        throw new Error("Firecrawl integration not found");
    }

    // Process parameters with array handling
    const params = {};
    
    // Handle string inputs that can be arrays
    const arrayFields = [
        'formats', 'include_tags', 'exclude_tags'
    ];
    
    arrayFields.forEach(field => {
        if (inputs[field] !== null && inputs[field] !== undefined) {
            params[field] = firecrawl.constructor.stringToArray(inputs[field]);
        }
    });

    // Handle other parameters with snake_case to API format conversion
    const paramMappings = {
        'url': 'url',
        'formats': 'formats',
        'only_main_content': 'onlyMainContent',
        'include_tags': 'includeTags',
        'exclude_tags': 'excludeTags',
        'max_age': 'maxAge',
        'wait_for': 'waitFor',
        'mobile_device': 'mobile',
        'skip_tls_verification': 'skipTlsVerification',
        'timeout': 'timeout',
        'remove_base64_images': 'removeBase64Images',
        'block_ads': 'blockAds',
        'proxy': 'proxy',
        'store_in_cache': 'storeInCache',
        'zero_data_retention': 'zeroDataRetention'
    };
    
    Object.entries(paramMappings).forEach(([inputKey, apiKey]) => {
        if (inputs[inputKey] !== null && inputs[inputKey] !== undefined) {
            params[apiKey] = inputs[inputKey];
        }
    });

    // Process parameters for API call
    const processedParams = firecrawl.constructor.processParams(params);
    
    // Make API request - let errors bubble up to be caught by error manager
    const response = await firecrawl.scrape(processedParams);

    // Extract data from response
    const data = response.data || {};
    const metadata = data.metadata || {};

    return {
        success: response.success || false,
        markdown: data.markdown || null,
        html: data.html || null,
        raw_html: data.rawHtml || null,
        links: data.links || [],
        screenshot: data.screenshot || null,
        summary: data.summary || null,
        metadata: metadata,
        status_code: metadata.statusCode || null,
        warning: data.warning || null
    };
};
