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

        const { document_id, chunk_index, before = 1, after = 2, separator = "\n\n" } = inputs;
        if (!document_id || typeof document_id !== 'string') {
            throw new Error("document_id is required and must be a string");
        }
        if (chunk_index === undefined || chunk_index === null || Number.isNaN(Number(chunk_index))) {
            throw new Error("chunk_index is required and must be a number");
        }

        const chunks = await knowledgeBase.getChunkWindow(document_id, Number(chunk_index), {
            before,
            after,
        });
        const content = chunks.map((c) => c.content ?? '').join(separator);

        return { chunks, content, count: chunks.length, success: true, error: null };
    } catch (error) {
        return { chunks: [], content: '', count: 0, success: false, error: error.message };
    }
};
