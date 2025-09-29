export default async ({inputs, settings, config, nodeConfig}) => {
    try {
        // Get knowledge base integration
        const knowledgeBase = config.integrations?.knowledgeBase || config.integrations?.sqlite;
        
        if (!knowledgeBase) {
            throw new Error("Knowledge base integration not found. Make sure a knowledge database is available.");
        }

        const { 
            document_id, 
            chunk_index 
        } = inputs;

        if (!document_id || typeof document_id !== 'string') {
            throw new Error("Document ID is required and must be a string");
        }

        if (chunk_index === undefined || chunk_index === null || typeof chunk_index !== 'number') {
            throw new Error("Chunk index is required and must be a number");
        }

        // Query for the specific chunk
        const query = `
            SELECT 
                c.id,
                c.document_id,
                c.chunk_index,
                c.content,
                c.token_count,
                c.chunk_type,
                c.metadata,
                c.embedding_model,
                c.embedding_dimensions,
                c.created_at,
                d.display_name as document_name,
                d.file_type,
                d.folder_path
            FROM chunks c
            LEFT JOIN documents d ON c.document_id = d.id
            WHERE c.document_id = ? AND c.chunk_index = ?
            LIMIT 1
        `;

        const results = await knowledgeBase.select(query, [document_id, chunk_index]);

        if (!results || (Array.isArray(results) && results.length === 0)) {
            return {
                chunk: null,
                found: false,
                error: null
            };
        }

        const chunk = Array.isArray(results) ? results[0] : results;

        // Parse metadata if it exists
        if (chunk.metadata) {
            try {
                chunk.metadata = JSON.parse(chunk.metadata);
            } catch (error) {
                console.warn('[WARN] Failed to parse chunk metadata:', error.message);
            }
        }

        return {
            chunk: chunk,
            found: true,
            error: null
        };

    } catch (error) {
        // Return error information instead of throwing to prevent engine crash
        return {
            chunk: null,
            found: false,
            error: error.message
        };
    }
};
