export default async ({inputs, config}) => {
   // Resolve which knowledge base to query — SAME wiring as semantic-search
   // and keyword-search: a `knowledge_base` handle wired in from a Knowledge
   // Base node names a specific KB by uuid (resolved to a per-KB integration
   // keyed knowledgeBase:<uuid>), falling back to the flow-global KB. See ADR 0023.
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

    const { query, params = [], operation = 'SELECT' } = inputs;

    if (!query || typeof query !== 'string') {
        throw new Error("Query is required and must be a string");
    }

    if (!Array.isArray(params)) {
        throw new Error("Parameters must be an array");
    }

    // Validate operation type
    const allowedOperations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
    if (!allowedOperations.includes(operation.toUpperCase())) {
        throw new Error(`Invalid operation type: ${operation}. Must be one of: ${allowedOperations.join(', ')}`);
    }

    // Execute the query
    const result = await knowledgeBase.query(query, params, operation);

    return {
        data: result.data,
        success: result.success,
        rowCount: result.rowCount,
        operation: result.operation,
        error: null
    };
};
