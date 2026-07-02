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

        const { from, to, max_depth = 4 } = inputs;
        if (typeof from !== "string" || from.trim().length === 0) {
            throw new Error("A from entity name or id is required.");
        }
        if (typeof to !== "string" || to.trim().length === 0) {
            throw new Error("A to entity name or id is required.");
        }

        const result = await knowledgeBase.findPath(from.trim(), to.trim(), {
            max_depth,
        });

        if (!result.from || !result.to) {
            const missing = !result.from ? from : to;
            return {
                found: false,
                hops: 0,
                steps: [],
                success: false,
                error: `No entity named "${missing}" in this knowledge base. Use List Entities to see what exists.`,
            };
        }

        return {
            found: result.found,
            hops: result.hops,
            steps: result.steps,
            success: true,
            error: null,
        };
    } catch (error) {
        return { found: false, hops: 0, steps: [], success: false, error: error.message };
    }
};
