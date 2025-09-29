export default async ({inputs, settings, config, nodeConfig}) => {
    try {
        // Get knowledge base integration
        const knowledgeBase = config.integrations?.knowledgeBase || config.integrations?.sqlite;
        
        if (!knowledgeBase) {
            throw new Error("Knowledge base integration not found. Make sure a knowledge database is available.");
        }

        const { 
            document_id,
            include_metadata = false,
            separator = "\n\n---\n\n"
        } = inputs;

        if (!document_id || typeof document_id !== 'string') {
            throw new Error("Document ID is required and must be a string");
        }

        // First, get document information
        const documentQuery = `
            SELECT 
                id,
                display_name,
                file_type,
                file_size,
                folder_path,
                created_at,
                updated_at
            FROM documents
            WHERE id = ?
            LIMIT 1
        `;

        const documentResults = await knowledgeBase.select(documentQuery, [document_id]);
        

        if (!documentResults || (Array.isArray(documentResults) && documentResults.length === 0)) {
            throw new Error(`Document with ID '${document_id}' not found`);
        }

        const documentInfo = Array.isArray(documentResults) ? documentResults[0] : documentResults;

        // Get all chunks for the document, ordered by chunk_index
        const chunksQuery = `
            SELECT 
                id,
                chunk_index,
                content,
                token_count,
                chunk_type,
                metadata,
                created_at
            FROM chunks
            WHERE document_id = ?
            ORDER BY chunk_index ASC
        `;

        const chunks = await knowledgeBase.select(chunksQuery, [document_id]);

        if (!chunks || chunks.length === 0) {
            return {
                content: "",
                chunk_count: 0,
                document_info: documentInfo,
                error: null
            };
        }

        // Combine chunks into markdown content
        const combinedChunks = chunks.map((chunk, index) => {
            let chunkContent = chunk.content;

            // Add metadata if requested
            if (include_metadata) {
                let metadata = {};
                if (chunk.metadata) {
                    try {
                        metadata = JSON.parse(chunk.metadata);
                    } catch (error) {
                        console.warn('[WARN] Failed to parse chunk metadata:', error.message);
                    }
                }

                const metadataString = Object.keys(metadata).length > 0 
                    ? `\n\n<!-- Metadata: ${JSON.stringify(metadata, null, 2)} -->`
                    : '';

                chunkContent = `## Chunk ${chunk.chunk_index}${metadataString}\n\n${chunkContent}`;
            }

            return chunkContent;
        });

        const combinedContent = combinedChunks.join(separator);
        
        // Add document header
        const documentHeader = `# ${documentInfo.display_name}\n\n*Document ID: ${documentInfo.id}*\n*File Type: ${documentInfo.file_type}*\n*Chunks: ${chunks.length}*\n\n`;

        const finalContent = documentHeader + combinedContent;

        return {
            content: finalContent,
            chunk_count: chunks.length,
            document_info: documentInfo,
            error: null
        };

    } catch (error) {
        console.error('Error in combine-document-chunks:', error);
        // Return error information instead of throwing to prevent engine crash
        return {
            content: "",
            chunk_count: 0,
            document_info: null,
            error: error.message
        };
    }
};
