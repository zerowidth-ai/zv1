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

        const sampleLimit =
            typeof inputs.sample_rows === "number" ? inputs.sample_rows : 5;
        const tables = await knowledgeBase.listTables({ sampleLimit });

        // A ready-to-paste schema block for an LLM: CREATE TABLE DDL + a few
        // sample rows (as comments) per table. Drop `schema` straight into an
        // LLM node's context to write SQL for the Query Knowledge Base node.
        const schema = tables
            .map((t) => {
                const lines = [t.ddl];
                if (Array.isArray(t.sample_rows) && t.sample_rows.length > 0) {
                    lines.push("-- sample rows:");
                    for (const row of t.sample_rows) {
                        lines.push("-- " + JSON.stringify(row));
                    }
                }
                return lines.join("\n");
            })
            .join("\n\n");

        return { tables, schema, count: tables.length, success: true, error: null };
    } catch (error) {
        return { tables: [], schema: "", count: 0, success: false, error: error.message };
    }
};
