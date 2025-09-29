import axios from 'axios';

export default class OpenAIIntegration {
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey;
        this.options = {
            baseURL: 'https://api.openai.com/v1',
            timeout: 30000,
            ...options
        };
    }

    /**
     * Create embeddings for text using OpenAI's embedding models
     * @param {string|Array} input - Text or array of texts to embed
     * @param {string} model - Embedding model to use (default: text-embedding-3-small)
     * @returns {Promise<Object>} Embedding response
     */
    async createEmbedding(input, model = 'text-embedding-3-small') {
        try {
            const response = await axios({
                url: `${this.options.baseURL}/embeddings`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                data: {
                    model: model,
                    input: input
                },
                timeout: this.options.timeout
            });

            if (response.status >= 400) {
                throw new Error(`OpenAI API error: ${response.status} - ${response.data?.error?.message || response.statusText}`);
            }

            return {
                data: response.data.data,
                model: response.data.model,
                usage: response.data.usage
            };

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText;
                const responseData = error.response.data;
                
                let errorMessage = `OpenAI Embeddings API Error (${status} ${statusText})`;
                if (responseData?.error?.message) {
                    errorMessage += `: ${responseData.error.message}`;
                }
                
                throw new Error(errorMessage);
            } else if (error.request) {
                throw new Error('OpenAI Embeddings API Error: No response received');
            } else {
                throw new Error(`OpenAI Embeddings API Error: ${error.message}`);
            }
        }
    }

    /**
     * Moderate content using OpenAI's moderation API
     * @param {string|Array|Object} input - Content to moderate
     * @returns {Promise<Object>} Moderation results
     */
    async moderateContent(input) {
        try {
            // Extract content from Message object or use input directly
            let moderationInput = input;
            
            // Handle Message object with {role, content} structure
            if (input && typeof input === 'object' && !Array.isArray(input) && input.content !== undefined) {
                moderationInput = input.content;
            }
            
            // If it's a string, use it directly
            // If it's an array, use it as-is (should be multi-modal format)
            if (typeof moderationInput === 'string') {
                moderationInput = moderationInput;
            } else if (Array.isArray(moderationInput)) {
                moderationInput = moderationInput;
            } else {
                // Convert single object to array
                moderationInput = [moderationInput];
            }

            const response = await axios({
                url: `${this.options.baseURL}/moderations`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                data: {
                    model: 'omni-moderation-latest',
                    input: moderationInput
                },
                timeout: this.options.timeout,
                validateStatus: () => true // Always resolve, never throw for HTTP errors
            });

            if (response.status >= 400) {
                throw new Error(`OpenAI Moderation API error: ${response.status} - ${response.data?.error?.message || response.statusText}`);
            }

            // Extract the first result (API returns array of results)
            const result = response.data.results && response.data.results[0] ? response.data.results[0] : {};
            const categories = result.categories || {};
            const categoryScores = result.category_scores || {};

            return {
                flagged: result.flagged || false,
                sexual: categories.sexual || false,
                sexual_score: categoryScores.sexual || 0,
                sexual_minors: categories['sexual/minors'] || false,
                sexual_minors_score: categoryScores['sexual/minors'] || 0,
                harassment: categories.harassment || false,
                harassment_score: categoryScores.harassment || 0,
                harassment_threatening: categories['harassment/threatening'] || false,
                harassment_threatening_score: categoryScores['harassment/threatening'] || 0,
                hate: categories.hate || false,
                hate_score: categoryScores.hate || 0,
                hate_threatening: categories['hate/threatening'] || false,
                hate_threatening_score: categoryScores['hate/threatening'] || 0,
                illicit: categories.illicit || false,
                illicit_score: categoryScores.illicit || 0,
                illicit_violent: categories['illicit/violent'] || false,
                illicit_violent_score: categoryScores['illicit/violent'] || 0,
                self_harm: categories['self-harm'] || false,
                self_harm_score: categoryScores['self-harm'] || 0,
                self_harm_intent: categories['self-harm/intent'] || false,
                self_harm_intent_score: categoryScores['self-harm/intent'] || 0,
                self_harm_instructions: categories['self-harm/instructions'] || false,
                self_harm_instructions_score: categoryScores['self-harm/instructions'] || 0,
                violence: categories.violence || false,
                violence_score: categoryScores.violence || 0,
                violence_graphic: categories['violence/graphic'] || false,
                violence_graphic_score: categoryScores['violence/graphic'] || 0
            };

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText;
                const responseData = error.response.data;
                
                let errorMessage = `OpenAI Moderation API Error (${status} ${statusText})`;
                if (responseData?.error?.message) {
                    errorMessage += `: ${responseData.error.message}`;
                }
                
                throw new Error(errorMessage);
            } else if (error.request) {
                throw new Error('OpenAI Moderation API Error: No response received');
            } else {
                throw new Error(`OpenAI Moderation API Error: ${error.message}`);
            }
        }
    }
}
