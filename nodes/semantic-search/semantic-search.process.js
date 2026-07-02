export default async ({inputs, settings, config, nodeConfig}) => {
    try {
        // Resolve which knowledge base to search. Node-level binding: a
        // `knowledge_base` handle wired in from a Knowledge Base node names a
        // specific KB by uuid, resolved to a per-KB integration the host keyed
        // as config.integrations.knowledgeBases[uuid]. Falls back to the
        // flow-global KB (config.integrations.knowledgeBase / .sqlite) so
        // existing single-KB flows keep working. See ADR 0023.
        const kbRef = inputs.knowledge_base;
        const kbByUuid =
            kbRef && kbRef.uuid
                ? config.integrations?.[`knowledgeBase:${kbRef.uuid}`]
                : null;
        const knowledgeBase =
            kbByUuid ||
            config.integrations?.knowledgeBase ||
            config.integrations?.sqlite;
        const openrouter = config.integrations?.openrouter;

        if (!knowledgeBase) {
            throw new Error("Knowledge base integration not found. Make sure a knowledge database is available.");
        }

        if (!openrouter) {
            throw new Error("OpenRouter integration not found. Semantic search requires an OpenRouter API key for query embeddings.");
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

        // Embedding model: node-setting override, else the model the KB was
        // indexed with (KB-owned — query + index MUST agree so semanticSearch
        // can filter `embedding_model = ?`). OpenRouter model ids are
        // namespaced, e.g. "openai/text-embedding-3-small".
        let modelToUse = embedding_model;
        if (!modelToUse) {
            try {
                modelToUse = await knowledgeBase.getEmbeddingModel();
            } catch (error) {
                console.warn('[WARN] Failed to get embedding model from knowledge base, using default:', error.message);
                modelToUse = 'openai/text-embedding-3-small';
            }
        }

        // Embed the query via OpenRouter. Returns { embedding, embeddings,
        // dimensions, model, usage, cost_total?, cost_itemized? }.
        const embeddingResponse = await openrouter.createEmbedding(
            { model: modelToUse, input: query },
            nodeConfig,
            config
        );
        const queryEmbedding = embeddingResponse.embedding;

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
