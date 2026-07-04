export default async ({ inputs, config }) => {
    try {
        // Resolve which knowledge base to search — SAME wiring as semantic-search
        // and query-knowledge-base: a `knowledge_base` handle wired in from a
        // Knowledge Base node names a specific KB by uuid (resolved to a per-KB
        // integration keyed knowledgeBase:<uuid>), falling back to the
        // flow-global KB. See ADR 0023.
        const kbRef = inputs.knowledge_base;
        const knowledgeBase =
            (kbRef && kbRef.uuid
                ? config.integrations?.[`knowledgeBase:${kbRef.uuid}`]
                : null) ||
            config.integrations?.knowledgeBase ||
            config.integrations?.sqlite;

        if (!knowledgeBase) {
            throw new Error("Knowledge base integration not found. Make sure a knowledge database is available.");
        }

        const { query, limit = 10, document_id = null } = inputs;

        if (!query || typeof query !== 'string') {
            throw new Error("Query is required and must be a string");
        }

        // No embeddings — a case-insensitive substring match over chunk content.
        const results = await knowledgeBase.keywordSearch(query, { limit, document_id });

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
