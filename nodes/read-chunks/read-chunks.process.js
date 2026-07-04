export default async ({ inputs, config }) => {
    try {
        // Shared KB wiring (see semantic-search / keyword-search). ADR 0023.
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

        const { document_id, start_index = 0, limit = 10 } = inputs;
        if (!document_id || typeof document_id !== 'string') {
            throw new Error("document_id is required and must be a string");
        }

        // Fetch one extra to detect whether more chunks remain after this page.
        const fetched = await knowledgeBase.getChunks(document_id, {
            startIndex: start_index,
            limit: limit + 1,
        });
        const hasMore = fetched.length > limit;
        const chunks = hasMore ? fetched.slice(0, limit) : fetched;
        const last = chunks[chunks.length - 1];
        const nextIndex = hasMore && last ? last.chunk_index + 1 : null;

        return {
            chunks,
            count: chunks.length,
            next_index: nextIndex,
            has_more: hasMore,
            success: true,
            error: null,
        };
    } catch (error) {
        return {
            chunks: [],
            count: 0,
            next_index: null,
            has_more: false,
            success: false,
            error: error.message,
        };
    }
};
