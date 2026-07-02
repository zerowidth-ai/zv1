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

        const tables = await knowledgeBase.listTables();
        return { tables, count: tables.length, success: true, error: null };
    } catch (error) {
        return { tables: [], count: 0, success: false, error: error.message };
    }
};
