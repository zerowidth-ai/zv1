import axios from 'axios';

export default class FirecrawlIntegration {
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey;
        this.options = {
            baseURL: 'https://api.firecrawl.dev/v2',
            timeout: 60000, // Longer timeout for scraping operations
            ...options
        };
    }

    /**
     * Scrape a single URL with various options
     * @param {Object} params - Scraping parameters
     * @returns {Promise<Object>} Scraping response
     */
    async scrape(params = {}) {
        try {
            const url = `${this.options.baseURL}/scrape`;

            // Remove any params that are null, undefined, or empty strings
            Object.keys(params).forEach(key => {
                if (params[key] === '') {
                    delete params[key];
                }
                if (params[key] === null) {
                    delete params[key];
                }
                if (params[key] === undefined) {
                    delete params[key];
                }
                if (Array.isArray(params[key]) && params[key].length === 0) {
                    delete params[key];
                }
            });

            console.log('Firecrawl API URL:', url);
            console.log('Firecrawl API Params:', params);

            const response = await axios({
                url: url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                data: params,
                timeout: this.options.timeout
            });

            if (response.status >= 400) {
                throw new Error(`Firecrawl API error: ${response.status} - ${response.data?.error || response.statusText}`);
            }

            return response.data;

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText;
                const responseData = error.response.data;
                
                let errorMessage = `Firecrawl API Error (${status} ${statusText})`;
                if (responseData?.error) {
                    errorMessage += `: ${responseData.error}`;
                }
                
                throw new Error(errorMessage);
            } else if (error.request) {
                throw new Error('Firecrawl API Error: No response received');
            } else {
                throw new Error(`Firecrawl API Error: ${error.message}`);
            }
        }
    }

    /**
     * Helper function to convert comma-separated string to array
     * @param {string|Array} input - String or array input
     * @returns {Array} Array of strings
     */
    static stringToArray(input) {
        if (Array.isArray(input)) {
            return input;
        }
        if (typeof input === 'string') {
            return input.split(',').map(item => item.trim()).filter(item => item.length > 0);
        }
        return [];
    }

    /**
     * Helper function to build query parameters with array handling
     * @param {Object} params - Raw parameters
     * @returns {Object} Processed parameters
     */
    static processParams(params) {
        const processed = { ...params };
        
        // Handle parameter name mappings (snake_case input names to API parameter names)
        const paramMappings = {
            'include_tags': 'includeTags',
            'exclude_tags': 'excludeTags',
            'only_main_content': 'onlyMainContent',
            'max_age': 'maxAge',
            'wait_for': 'waitFor',
            'mobile_device': 'mobile',
            'skip_tls_verification': 'skipTlsVerification',
            'remove_base64_images': 'removeBase64Images',
            'block_ads': 'blockAds',
            'store_in_cache': 'storeInCache',
            'zero_data_retention': 'zeroDataRetention'
        };
        
        // Apply parameter name mappings
        Object.entries(paramMappings).forEach(([inputKey, apiKey]) => {
            if (processed[inputKey] !== undefined) {
                processed[apiKey] = processed[inputKey];
                delete processed[inputKey]; // Remove the old key
            }
        });
        
        // Fields that should be converted from comma-separated strings to arrays
        const arrayFields = [
            'includeTags', 'excludeTags', 'formats'
        ];

        arrayFields.forEach(field => {
            if (processed[field] !== undefined) {
                const arrayValue = this.stringToArray(processed[field]);
                if (arrayValue.length > 0) {
                    processed[field] = arrayValue;
                }
            }
        });

        // Handle formats - convert string to array of objects if needed
        if (processed.formats && Array.isArray(processed.formats)) {
            processed.formats = processed.formats.map(format => {
                if (typeof format === 'string') {
                    return { type: format };
                }
                return format;
            });
        }

        return processed;
    }
}
