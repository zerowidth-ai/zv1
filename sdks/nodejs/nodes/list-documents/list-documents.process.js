export default async ({ inputs, config }) => {
    try {
        // Shared KB wiring (see semantic-search / keyword-search): a
        // knowledge_base handle names a KB by uuid, falling back to the
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

        const { limit = 100, offset = 0 } = inputs;
        const documents = await knowledgeBase.listDocuments({ limit, offset });

        return { documents, count: documents.length, success: true, error: null };
    } catch (error) {
        return { documents: [], count: 0, success: false, error: error.message };
    }
};
