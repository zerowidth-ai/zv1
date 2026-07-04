import axios from 'axios';

export default async ({inputs, settings, config}) => {
    try {
        const input = inputs.input;
        if (!input) {
            throw new Error("Input is required for moderation");
        }

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

        // Get API key from config
        const apiKey = config.keys?.openai;
        if (!apiKey) {
            throw new Error("OpenAI API key not found in config.keys.openai");
        }

        const response = await axios({
            url: 'https://api.openai.com/v1/moderations',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            data: {
                model: 'omni-moderation-latest',
                input: moderationInput
            },
            timeout: 10000,
            validateStatus: () => true // Always resolve, never throw for HTTP errors
        });

        if (response.status >= 400) {
            throw new Error(`OpenAI API error: ${response.status} - ${response.data?.error?.message || response.statusText}`);
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
        console.log('OpenAI Omni Moderation error:', error);
        throw new Error(`OpenAI Omni Moderation error: ${error.message}`);
    }
};
