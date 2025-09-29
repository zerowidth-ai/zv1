export default async ({inputs, settings, config, nodeConfig}) => {
    try {
        // Get knowledge base and OpenAI integrations
        const knowledgeBase = config.integrations?.knowledgeBase || config.integrations?.sqlite;
        const openai = config.integrations?.openai;
        
        if (!knowledgeBase) {
            throw new Error("Knowledge base integration not found. Make sure a knowledge database is available.");
        }
        
        if (!openai) {
            throw new Error("OpenAI integration not found. Semantic search requires OpenAI API key for embeddings.");
        }

        const { 
            query, 
            limit = 10, 
            similarity_threshold = 0.7, 
            document_id = null 
        } = inputs;
        
        const { embedding_model = null } = settings;

        if (!query || typeof query !== 'string') {
            throw new Error("Query is required and must be a string");
        }

        // Get the embedding model to use
        let modelToUse = embedding_model;
        if (!modelToUse) {
            try {
                modelToUse = await knowledgeBase.getEmbeddingModel();
            } catch (error) {
                console.warn('[WARN] Failed to get embedding model from knowledge base, using default:', error.message);
                modelToUse = 'text-embedding-3-small';
            }
        }

        // Create embedding for the query
        const embeddingResponse = await openai.createEmbedding(query, modelToUse);
        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Perform semantic search
        const searchOptions = {
            limit,
            similarity_threshold,
            document_id,
            embedding_model: modelToUse,
            query_embedding: queryEmbedding
        };

        const results = await knowledgeBase.semanticSearch(query, searchOptions);

        return {
            results: results,
            count: results.length,
            success: true,
            error: null
        };

    } catch (error) {
        // Return error information instead of throwing to prevent engine crash
        return {
            results: [],
            count: 0,
            success: false,
            error: error.message
        };
    }
};
