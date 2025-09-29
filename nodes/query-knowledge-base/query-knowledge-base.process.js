export default async ({inputs, settings, config, nodeConfig}) => {
   // Get knowledge base integration from engine (supports multiple backends)
   const knowledgeBase = config.integrations?.knowledgeBase || config.integrations?.sqlite;
   if (!knowledgeBase) {
       throw new Error("Knowledge base integration not found. Make sure a knowledge database is available.");
   }

    const { query, params = [], operation = 'SELECT' } = inputs;
    const { database_path = 'knowledge.db', timeout = 5000 } = settings;

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
