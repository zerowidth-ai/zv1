import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { KnowledgeBaseInterface } from './knowledge-base-interface.js';

// Import sqlite-vec extension
import * as sqliteVec from 'sqlite-vec';

export default class SQLiteIntegration extends KnowledgeBaseInterface {
    constructor(dbPath, options = {}) {
        super(); // Call parent constructor first
        this.dbPath = dbPath;
        this.options = {
            // Default options
            timeout: 5000, // 5 second timeout for queries
            ...options
        };
        this.db = null;
        this.isConnected = false;
    }

    /**
     * Initialize the database connection
     * @returns {Promise<void>}
     */
  async connect() {
    try {

      
      // Check if database file exists
      if (!fs.existsSync(this.dbPath)) {
        throw new Error(`Database file not found: ${this.dbPath}`);
      }

      // Create database connection
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          throw new Error(`Failed to connect to database: ${err.message}`);
        }
      });

            // Promisify the database methods
            this.db.run = promisify(this.db.run.bind(this.db));
            this.db.get = promisify(this.db.get.bind(this.db));
            this.db.all = promisify(this.db.all.bind(this.db));
            this.db.close = promisify(this.db.close.bind(this.db));

            // Load sqlite-vec extension
            try {
                sqliteVec.load(this.db);
            } catch (error) {
                console.warn('[WARN] Failed to load sqlite-vec extension:', error.message);
                // Don't fail the connection, just warn
            }

            // Test the connection
            await this.db.get("SELECT 1");
            this.isConnected = true;

        } catch (error) {
            this.isConnected = false;
            throw new Error(`SQLite connection failed: ${error.message}`);
        }
    }

  /**
   * Close the database connection and clean up temporary files
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.db && this.isConnected) {
      try {
        await this.db.close();
        this.isConnected = false;
      } catch (error) {
        throw new Error(`Failed to close database: ${error.message}`);
      }
    }
    
    // Clean up temporary file if it exists
    if (this.dbPath && (this.dbPath.includes('.temp') || this.dbPath.includes('knowledge_'))) {
      try {
        if (fs.existsSync(this.dbPath)) {
          fs.unlinkSync(this.dbPath);
        }
      } catch (error) {
        console.warn(`[WARN] Failed to cleanup temporary file ${this.dbPath}:`, error.message);
        // Don't throw - cleanup should be best effort
      }
    }
  }

    /**
     * Execute a raw SQL query
     * @param {string} query - SQL query to execute
     * @param {Array} params - Query parameters for parameterized queries
     * @param {string} operation - Type of operation (SELECT, INSERT, UPDATE, DELETE)
     * @returns {Promise<Object>} Query result
     */
    async query(query, params = [], operation = 'SELECT') {
        if (!this.isConnected) {
            await this.connect();
        }

        try {
            // Basic SQL injection prevention - only allow certain operations
            const allowedOperations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'];
            const queryUpper = query.trim().toUpperCase();
            const isAllowed = allowedOperations.some(op => queryUpper.startsWith(op));
            
            if (!isAllowed) {
                throw new Error(`Operation not allowed: ${queryUpper.split(' ')[0]}`);
            }

            // Execute query based on operation type
            let result;
            if (operation.toUpperCase() === 'SELECT') {
                if (queryUpper.includes('LIMIT 1')) {
                    result = await this.db.get(query, params);
                } else {
                    result = await this.db.all(query, params);
                }
            } else {
                result = await this.db.run(query, params);
            }

            return {
                success: true,
                data: result,
                operation: operation.toUpperCase(),
                rowCount: result?.changes || (Array.isArray(result) ? result.length : 0)
            };

        } catch (error) {
            throw new Error(`SQLite query failed: ${error.message}`);
        }
    }

    /**
     * Execute a SELECT query with parameterized values
     * @param {string} query - SQL SELECT query
     * @param {Array} params - Query parameters
     * @returns {Promise<Array>} Query results
     */
    async select(query, params = []) {
        const result = await this.query(query, params, 'SELECT');
        return result.data || [];
    }

    /**
     * Execute an INSERT query
     * @param {string} query - SQL INSERT query
     * @param {Array} params - Query parameters
     * @returns {Promise<Object>} Insert result with lastID
     */
    async insert(query, params = []) {
        const result = await this.query(query, params, 'INSERT');
        return {
            success: result.success,
            lastID: result.data?.lastID,
            changes: result.data?.changes
        };
    }

    /**
     * Execute an UPDATE query
     * @param {string} query - SQL UPDATE query
     * @param {Array} params - Query parameters
     * @returns {Promise<Object>} Update result with changes count
     */
    async update(query, params = []) {
        const result = await this.query(query, params, 'UPDATE');
        return {
            success: result.success,
            changes: result.data?.changes
        };
    }

    /**
     * Execute a DELETE query
     * @param {string} query - SQL DELETE query
     * @param {Array} params - Query parameters
     * @returns {Promise<Object>} Delete result with changes count
     */
    async delete(query, params = []) {
        const result = await this.query(query, params, 'DELETE');
        return {
            success: result.success,
            changes: result.data?.changes
        };
    }

    /**
     * Get database schema information
     * @returns {Promise<Object>} Schema information
     */
    async getSchema() {
        const tables = await this.select(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);

        const schema = {};
        for (const table of tables) {
            const columns = await this.select(`PRAGMA table_info(${table.name})`);
            schema[table.name] = columns;
        }

        return schema;
    }

    /**
     * Check if the database has the expected knowledge base schema
     * @returns {Promise<Object>} Schema validation result
     */
    async validateKnowledgeBaseSchema() {
        try {
            const schema = await this.getSchema();
            
            const hasDocuments = 'documents' in schema;
            const hasChunks = 'chunks' in schema;
            
            if (!hasDocuments || !hasChunks) {
                return {
                    valid: false,
                    missing: {
                        documents: !hasDocuments,
                        chunks: !hasChunks
                    }
                };
            }

            // Check for required columns in documents table
            const documentsColumns = schema.documents.map(col => col.name);
            const requiredDocColumns = ['id', 'display_name', 'file_type', 'file_size', 'created_by', 'created_at', 'updated_at'];
            const missingDocColumns = requiredDocColumns.filter(col => !documentsColumns.includes(col));

            // Check for required columns in chunks table
            const chunksColumns = schema.chunks.map(col => col.name);
            const requiredChunkColumns = ['id', 'document_id', 'chunk_index', 'content', 'created_at', 'updated_at'];
            const missingChunkColumns = requiredChunkColumns.filter(col => !chunksColumns.includes(col));

            return {
                valid: missingDocColumns.length === 0 && missingChunkColumns.length === 0,
                missing: {
                    documents: missingDocColumns,
                    chunks: missingChunkColumns
                }
            };

        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Get basic statistics about the knowledge base
     * @returns {Promise<Object>} Knowledge base statistics
     */
    async getStats() {
        try {
            const docCount = await this.select('SELECT COUNT(*) as count FROM documents');
            const chunkCount = await this.select('SELECT COUNT(*) as count FROM chunks');
            const totalSize = await this.select('SELECT SUM(file_size) as total_size FROM documents');
            
            return {
                documents: docCount[0]?.count || 0,
                chunks: chunkCount[0]?.count || 0,
                totalSize: totalSize[0]?.total_size || 0
            };
        } catch (error) {
            throw new Error(`Failed to get knowledge base stats: ${error.message}`);
        }
    }

    /**
     * Get the embedding model used by this knowledge base
     * @returns {Promise<string>} Embedding model name
     */
    async getEmbeddingModel() {
        try {
            const recentChunk = await this.select(
                'SELECT embedding_model FROM chunks WHERE embedding_model IS NOT NULL ORDER BY created_at DESC LIMIT 1'
            );
            
            if (recentChunk.length > 0 && recentChunk[0].embedding_model) {
                return recentChunk[0].embedding_model;
            }
            
            // Fall back to default
            return 'text-embedding-3-small';
        } catch (error) {
            console.warn('[WARN] Failed to get embedding model from database, using default:', error.message);
            return 'text-embedding-3-small';
        }
    }

    /**
     * Perform semantic search using vector similarity
     * @param {string} query - Text query to search for
     * @param {Object} options - Search options
     * @param {number} options.limit - Maximum number of results (default: 10)
     * @param {number} options.similarity_threshold - Minimum similarity score (default: 0.7)
     * @param {string} options.document_id - Filter by specific document
     * @param {string} options.embedding_model - Model to use for query embedding
     * @returns {Promise<Array>} Search results with similarity scores
     */
    async semanticSearch(query, options = {}) {
        const {
            limit = 10,
            similarity_threshold = 0.7,
            document_id = null,
            embedding_model = null
        } = options;

        try {
            if (!this.isConnected) {
                await this.connect();
            }

            // Get the embedding model to use
            let modelToUse = embedding_model;
            if (!modelToUse) {
                try {
                    modelToUse = await this.getEmbeddingModel();
                } catch (error) {
                    console.warn('[WARN] Failed to get embedding model from database, using default:', error.message);
                    modelToUse = 'text-embedding-3-small';
                }
            }

            // Check if sqlite-vec extension is loaded
            try {
                await this.db.get("SELECT vec_version()");
            } catch (error) {
                console.warn('[WARN] sqlite-vec extension not loaded properly, falling back to text search');
                return await this._fallbackTextSearch(query, options);
            }

            // Check if query embedding is provided (generated by the calling semantic search node)
            if (!options.query_embedding) {
                console.warn('[WARN] No query embedding provided, falling back to text search');
                return await this._fallbackTextSearch(query, options);
            }

            const queryEmbedding = options.query_embedding;
            const embeddingDimensions = queryEmbedding.length;
            const queryEmbeddingString = JSON.stringify(queryEmbedding);
            
            // Build the KNN query using sqlite-vec scalar functions
            let searchSql = `
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
                    c.embedding,
                    c.created_at,
                    d.display_name as document_name,
                    d.file_type,
                    d.folder_path,
                    vec_distance_cosine(c.embedding, ?) as similarity
                FROM chunks c
                LEFT JOIN documents d ON c.document_id = d.id
                WHERE c.embedding IS NOT NULL
                    AND c.embedding_model = ?
                    AND c.embedding_dimensions = ?
                    AND vec_distance_cosine(c.embedding, ?) <= ?
            `;

            const params = [queryEmbeddingString, modelToUse, embeddingDimensions, queryEmbeddingString, similarity_threshold];

            // Add document filter if specified
            if (document_id) {
                searchSql += ' AND c.document_id = ?';
                params.push(document_id);
            }

            searchSql += `
                ORDER BY vec_distance_cosine(c.embedding, ?) ASC
                LIMIT ?
            `;

            // Add the query embedding and limit to params
            params.push(queryEmbeddingString, limit);

            const results = await this.db.all(searchSql, params);
            
            // Parse JSON metadata and format results
            return results.map(row => ({
                id: row.id,
                document_id: row.document_id,
                document_name: row.document_name,
                file_type: row.file_type,
                folder_path: row.folder_path,
                chunk_index: row.chunk_index,
                content: row.content,
                token_count: row.token_count,
                chunk_type: row.chunk_type,
                metadata: row.metadata ? JSON.parse(row.metadata) : {},
                embedding_model: row.embedding_model,
                embedding_dimensions: row.embedding_dimensions,
                similarity_score: row.similarity,
                created_at: row.created_at
            }));
            
        } catch (error) {
            console.warn('[WARN] Vector search failed, falling back to text search:', error.message);
            return await this._fallbackTextSearch(query, options);
        }
    }

    /**
     * Fallback text search when vector search is not available
     * @param {string} query - Text query to search for
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Search results with mock similarity scores
     */
    async _fallbackTextSearch(query, options = {}) {
        const {
            limit = 10,
            document_id = null
        } = options;

        try {
            let sql = `
                SELECT 
                    c.id,
                    c.document_id,
                    c.chunk_index,
                    c.content,
                    c.token_count,
                    c.chunk_type,
                    c.metadata,
                    d.display_name as document_name,
                    d.file_type,
                    d.folder_path,
                    c.created_at
                FROM chunks c
                LEFT JOIN documents d ON c.document_id = d.id
                WHERE c.content LIKE ?
            `;
            
            const params = [`%${query}%`];
            
            if (document_id) {
                sql += ' AND c.document_id = ?';
                params.push(document_id);
            }
            
            sql += ' ORDER BY c.created_at DESC LIMIT ?';
            params.push(limit);
            
            const results = await this.select(sql, params);
            
            // Add mock similarity scores for text search
            return results.map((result, index) => ({
                ...result,
                similarity_score: 1.0 - (index * 0.1), // Mock decreasing similarity
                match_type: 'text_search'
            }));
            
        } catch (error) {
            throw new Error(`Fallback text search failed: ${error.message}`);
        }
    }
}
