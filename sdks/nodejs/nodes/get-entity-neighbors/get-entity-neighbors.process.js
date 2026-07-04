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

        const { entity, direction = "both", relation_type = null, limit = 50 } = inputs;
        if (typeof entity !== "string" || entity.trim().length === 0) {
            throw new Error("An entity name or id is required.");
        }

        const result = await knowledgeBase.getNeighbors(entity.trim(), {
            direction,
            relation_type,
            limit,
        });

        if (!result.entity) {
            // Soft-fail with a helpful message so an agent can recover by
            // listing entities instead of dead-ending.
            return {
                entity: null,
                neighbors: [],
                count: 0,
                success: false,
                error: `No entity named "${entity}" in this knowledge base. Use List Entities to see what exists.`,
            };
        }

        return {
            entity: result.entity,
            neighbors: result.neighbors,
            count: result.neighbors.length,
            success: true,
            error: null,
        };
    } catch (error) {
        return { entity: null, neighbors: [], count: 0, success: false, error: error.message };
    }
};
