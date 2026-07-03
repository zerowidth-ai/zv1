import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { KnowledgeBaseInterface } from './knowledge-base-interface.js';

// sqlite-vec ships a loadable extension (prebuilt per-platform .dylib/.so);
// `getLoadablePath()` returns the binary we hand to node:sqlite's
// `loadExtension`. No native node module / node-gyp build involved.
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
     * Initialize the database connection.
     *
     * Uses Node's built-in `node:sqlite` (DatabaseSync) — synchronous,
     * zero native dependency, uniform across Node 22+/24 and Linux — rather
     * than the legacy `sqlite3` native module. The public methods stay
     * `async` for call-site compatibility.
     * @returns {Promise<void>}
     */
  async connect() {
    try {
      // Check if database file exists
      if (!fs.existsSync(this.dbPath)) {
        throw new Error(`Database file not found: ${this.dbPath}`);
      }

      // Open the connection with extension loading allowed so sqlite-vec
      // can be attached.
      this.db = new DatabaseSync(this.dbPath, { allowExtension: true });

      // Load sqlite-vec extension. Enable extension loading first where the
      // runtime exposes the toggle (guarded for forward-compat).
      try {
        if (typeof this.db.enableLoadExtension === 'function') {
          this.db.enableLoadExtension(true);
        }
        this.db.loadExtension(sqliteVec.getLoadablePath());
      } catch (error) {
        console.warn('[WARN] Failed to load sqlite-vec extension:', error.message);
        // Don't fail the connection, just warn — semanticSearch falls back
        // to text search when vec functions are unavailable.
      }

      // Test the connection
      this._get('SELECT 1');
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
        this.db.close();
        this.isConnected = false;
      } catch (error) {
        throw new Error(`Failed to close database: ${error.message}`);
      }
    }

    // NOTE: disconnect() never deletes the database file. File lifecycle
    // belongs to whoever created the file — the engine tracks and removes
    // its own temp extractions (and hosts opt in via
    // config.knowledgeBase.cleanupDbFiles); a path-substring heuristic
    // here once deleted user-owned databases.
  }

  // ─── node:sqlite driver helpers ────────────────────────────────────────
  // DatabaseSync is synchronous: prepare once, bind anonymous `?` params by
  // spreading the params array. These wrap the three shapes the rest of the
  // class needs.

  _all(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  _get(sql, params = []) {
    return this.db.prepare(sql).get(...params);
  }

  _run(sql, params = []) {
    return this.db.prepare(sql).run(...params);
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
                if (/\bLIMIT\s+1\b(?!\s*,)/.test(queryUpper)) {
                    result = this._get(query, params);
                } else {
                    result = this._all(query, params);
                }
                return {
                    success: true,
                    data: result,
                    operation: operation.toUpperCase(),
                    rowCount: Array.isArray(result) ? result.length : (result ? 1 : 0)
                };
            }

            // Non-SELECT: run() returns { changes, lastInsertRowid }.
            const runResult = this._run(query, params);
            return {
                success: true,
                data: {
                    changes: Number(runResult.changes),
                    lastID: runResult.lastInsertRowid,
                },
                operation: operation.toUpperCase(),
                rowCount: Number(runResult.changes) || 0
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
            const rows = await this.select(
                'SELECT embedding_model FROM chunks WHERE embedding_model IS NOT NULL ORDER BY created_at DESC LIMIT 1'
            );

            // `select()` returns a single object for LIMIT-1 queries (query()
            // dispatches those through `_get`), or an array otherwise —
            // normalize to the first row. Reading `.length` on the object
            // silently missed the stored model and fell through to the default,
            // whose NON-namespaced value ("text-embedding-3-small") then never
            // matched the namespaced model the chunks are indexed under
            // ("openai/text-embedding-3-small"), so `WHERE embedding_model = ?`
            // dropped every row.
            const row = Array.isArray(rows) ? rows[0] : rows;
            if (row && row.embedding_model) {
                return row.embedding_model;
            }

            // Fall back to the namespaced default (matches the ingestion
            // default + OpenRouter's expected model id).
            return 'openai/text-embedding-3-small';
        } catch (error) {
            console.warn('[WARN] Failed to get embedding model from database, using default:', error.message);
            return 'openai/text-embedding-3-small';
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
                this._get("SELECT vec_version()");
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

            // vec_distance_cosine is a DISTANCE (0 = identical, larger = less
            // similar). Callers pass `similarity_threshold` in [0,1] (1 =
            // identical), so convert: similarity >= t  ⟺  distance <= (1 - t).
            // (Previously this compared distance `>= threshold`, which dropped
            // the closest matches and kept the farthest — inverted.)
            const maxDistance = 1 - similarity_threshold;
            const params = [queryEmbeddingString, modelToUse, embeddingDimensions, queryEmbeddingString, maxDistance];

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

            const results = this._all(searchSql, params);

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
                // `row.similarity` is the aliased cosine DISTANCE; report it as
                // an actual similarity in [-1, 1] (1 = identical).
                similarity_score: 1 - row.similarity,
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

    /**
     * Keyword (substring) search over chunk content — the free, no-embedding
     * complement to semanticSearch. Case-insensitive; ranks by number of
     * occurrences (mirrors the in-app KB "test search" keyword mode). Returns
     * the same row shape as semanticSearch (plus `match_count` / `match_type`).
     * @param {string} query - Text to match within chunk content
     * @param {Object} options - { limit = 10, document_id = null }
     * @returns {Promise<Array>} Matching chunks, most matches first
     */
    async keywordSearch(query, options = {}) {
        const { limit = 10, document_id = null } = options;
        if (!this.isConnected) {
            await this.connect();
        }
        const q = String(query ?? '');
        if (q.length === 0) return [];

        let sql = `
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
                d.display_name as document_name,
                d.file_type,
                d.folder_path,
                c.created_at
            FROM chunks c
            LEFT JOIN documents d ON c.document_id = d.id
            WHERE c.content LIKE ? COLLATE NOCASE
        `;
        const params = [`%${q}%`];
        if (document_id) {
            sql += ' AND c.document_id = ?';
            params.push(document_id);
        }

        // No SQL LIMIT: rank by occurrence count in JS, then slice.
        const rows = this._all(sql, params);
        const needle = q.toLowerCase();
        const scored = rows.map((row) => {
            const content = row.content ?? '';
            const hay = content.toLowerCase();
            let count = 0;
            let idx = hay.indexOf(needle);
            while (idx !== -1) {
                count++;
                idx = hay.indexOf(needle, idx + needle.length);
            }
            return {
                ...row,
                metadata: row.metadata ? JSON.parse(row.metadata) : {},
                match_count: count,
                match_type: 'keyword'
            };
        });
        scored.sort((a, b) => b.match_count - a.match_count || a.chunk_index - b.chunk_index);
        return scored.slice(0, limit);
    }

    /**
     * List documents in the knowledge base (navigation, not search).
     * @param {Object} options - { limit = 100, offset = 0 }
     * @returns {Promise<Array>} Document rows with a chunk_count each
     */
    async listDocuments(options = {}) {
        const { limit = 100, offset = 0 } = options;
        if (!this.isConnected) {
            await this.connect();
        }
        return this._all(
            `SELECT
                d.id, d.display_name, d.file_type, d.file_size, d.folder_path,
                d.created_at, d.updated_at,
                (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunk_count
             FROM documents d
             ORDER BY d.created_at ASC, d.display_name ASC
             LIMIT ? OFFSET ?`,
            [limit, offset],
        );
    }

    /**
     * Read chunks of a document in order, starting at a chunk index — for
     * pagination and "read what came after chunk N" (e.g. following a
     * similarity hit). Returns chunks with index >= startIndex, ascending.
     * @param {string} documentId
     * @param {Object} options - { startIndex = 0, limit = 10 }
     * @returns {Promise<Array>} Chunk rows (metadata parsed)
     */
    async getChunks(documentId, options = {}) {
        const { startIndex = 0, limit = 10 } = options;
        if (!this.isConnected) {
            await this.connect();
        }
        const rows = this._all(
            `SELECT id, document_id, chunk_index, content, token_count, chunk_type, metadata, created_at
             FROM chunks
             WHERE document_id = ? AND chunk_index >= ?
             ORDER BY chunk_index ASC
             LIMIT ?`,
            [documentId, startIndex, limit],
        );
        return rows.map((r) => ({
            ...r,
            metadata: r.metadata ? JSON.parse(r.metadata) : {},
        }));
    }

    /**
     * Read a window of chunks around a given chunk index — context expansion
     * for a chunk found via search (grab the N before / after it).
     * @param {string} documentId
     * @param {number} chunkIndex - The anchor chunk's index
     * @param {Object} options - { before = 1, after = 1 }
     * @returns {Promise<Array>} Chunk rows in the window, ascending (metadata parsed)
     */
    async getChunkWindow(documentId, chunkIndex, options = {}) {
        const { before = 1, after = 1 } = options;
        if (!this.isConnected) {
            await this.connect();
        }
        const lo = Math.max(0, Number(chunkIndex) - before);
        const hi = Number(chunkIndex) + after;
        const rows = this._all(
            `SELECT id, document_id, chunk_index, content, token_count, chunk_type, metadata, created_at
             FROM chunks
             WHERE document_id = ? AND chunk_index >= ? AND chunk_index <= ?
             ORDER BY chunk_index ASC`,
            [documentId, lo, hi],
        );
        return rows.map((r) => ({
            ...r,
            metadata: r.metadata ? JSON.parse(r.metadata) : {},
        }));
    }

    /**
     * Describe the tabular tables in a Tabular→SQL KB, from the `_kb_tables`
     * registry — everything an LLM needs to write correct SQL: the column
     * schema, a `CREATE TABLE` DDL (the format models expect), and a few
     * sample rows (which disambiguate value formats / casing far better than
     * types alone). Returns [] for a KB with no registry (e.g. a docs KB).
     * @param {Object} options - { sampleLimit = 5 } rows per table (0 = none)
     * @returns {Promise<Array>} [{ table_name, source_name, row_count, columns:[{name,type}], ddl, sample_rows }]
     */
    async listTables(options = {}) {
        const { sampleLimit = 5 } = options;
        if (!this.isConnected) {
            await this.connect();
        }
        let rows;
        try {
            rows = this._all(
                `SELECT table_name, source_name, row_count, columns
                 FROM _kb_tables
                 ORDER BY table_name ASC`,
            );
        } catch {
            return []; // no _kb_tables registry — not a tabular KB
        }
        return rows.map((r) => {
            const tableName = String(r.table_name ?? "");
            const columns = r.columns ? JSON.parse(r.columns) : [];
            let sample_rows = [];
            // Identifiers come from our own sanitizer, but guard the
            // interpolation before it reaches SQL anyway.
            if (sampleLimit > 0 && /^[a-zA-Z0-9_]+$/.test(tableName)) {
                try {
                    sample_rows = this._all(
                        `SELECT * FROM "${tableName}" LIMIT ?`,
                        [sampleLimit],
                    );
                } catch {
                    sample_rows = [];
                }
            }
            return {
                table_name: r.table_name,
                source_name: r.source_name,
                row_count: r.row_count,
                columns,
                ddl: buildCreateTableDDL(tableName, columns),
                sample_rows,
            };
        });
    }

    // ── Knowledge-graph traversal (Graph recipe, ADR 0023) ────────────
    // Graph KBs carry `nodes` + `edges` tables (entities + typed
    // relations, both with document provenance) alongside the same
    // `_kb_tables` registry tabular uses — so `listTables` / `query`
    // work on them unchanged; these methods add traversal sugar.
    // Soft-fail convention matches listTables: a KB without graph
    // tables returns empty shapes, never throws.

    /**
     * List entities, highest-degree first (degree = count of edges in
     * either direction), so the "important" nodes surface first.
     * @param {Object} options - { limit=100, offset=0, type=null, search=null }
     * @returns {Promise<Array>} [{ id, name, type, description, document_id, degree, created_at }]
     */
    async listEntities(options = {}) {
        const { limit = 100, offset = 0, type = null, search = null } = options;
        if (!this.isConnected) {
            await this.connect();
        }
        try {
            const where = [];
            const params = [];
            if (type) {
                where.push("n.type = ? COLLATE NOCASE");
                params.push(type);
            }
            if (search) {
                where.push("n.name LIKE ? COLLATE NOCASE");
                params.push(`%${search}%`);
            }
            return this._all(
                `SELECT n.*, (
                    SELECT COUNT(*) FROM edges e
                    WHERE e.source_id = n.id OR e.target_id = n.id
                 ) AS degree
                 FROM nodes n
                 ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                 ORDER BY degree DESC, n.name COLLATE NOCASE ASC
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset],
            );
        } catch {
            return []; // no nodes table — not a graph KB
        }
    }

    /**
     * Resolve an entity reference — exact id first, then
     * case-insensitive name. Returns the node row or null.
     */
    async getEntity(ref) {
        if (!this.isConnected) {
            await this.connect();
        }
        if (typeof ref !== "string" || ref.length === 0) return null;
        try {
            return (
                this._get(`SELECT * FROM nodes WHERE id = ?`, [ref]) ||
                this._get(
                    `SELECT * FROM nodes WHERE name = ? COLLATE NOCASE`,
                    [ref],
                ) ||
                null
            );
        } catch {
            return null;
        }
    }

    /**
     * Edges touching an entity, each joined with the node on the far
     * side. `direction` filters to edges where the entity is the
     * source ("out"), the target ("in"), or either ("both").
     * @param {string} entityRef - entity id or (case-insensitive) name
     * @param {Object} options - { direction="both", relation_type=null, limit=50 }
     * @returns {Promise<Object>} { entity, neighbors: [{ edge_id, relation_type, description, direction, node }] }
     */
    async getNeighbors(entityRef, options = {}) {
        const { direction = "both", relation_type = null, limit = 50 } = options;
        const entity = await this.getEntity(entityRef);
        if (!entity) return { entity: null, neighbors: [] };
        try {
            let directionSql;
            if (direction === "out") directionSql = "e.source_id = ?";
            else if (direction === "in") directionSql = "e.target_id = ?";
            else directionSql = "(e.source_id = ? OR e.target_id = ?)";
            const directionParams =
                direction === "out" || direction === "in"
                    ? [entity.id]
                    : [entity.id, entity.id];
            const typeSql = relation_type
                ? " AND e.type = ? COLLATE NOCASE"
                : "";
            const rows = this._all(
                `SELECT e.id AS edge_id, e.type AS relation_type,
                        e.description, e.source_id, e.target_id,
                        n.id AS node_id, n.name AS node_name,
                        n.type AS node_type, n.description AS node_description
                 FROM edges e
                 JOIN nodes n ON n.id = CASE
                    WHEN e.source_id = ? THEN e.target_id ELSE e.source_id
                 END
                 WHERE ${directionSql}${typeSql}
                 LIMIT ?`,
                [
                    entity.id,
                    ...directionParams,
                    ...(relation_type ? [relation_type] : []),
                    limit,
                ],
            );
            return {
                entity,
                neighbors: rows.map((r) => ({
                    edge_id: r.edge_id,
                    relation_type: r.relation_type,
                    description: r.description,
                    direction: r.source_id === entity.id ? "out" : "in",
                    node: {
                        id: r.node_id,
                        name: r.node_name,
                        type: r.node_type,
                        description: r.node_description,
                    },
                })),
            };
        } catch {
            return { entity, neighbors: [] };
        }
    }

    /**
     * Shortest path between two entities — BFS over edges, direction-
     * agnostic (relations read both ways for pathfinding). Edge count
     * is capped so a runaway artifact can't wedge a run.
     * @param {string} fromRef - entity id or (case-insensitive) name
     * @param {string} toRef - entity id or (case-insensitive) name
     * @param {Object} options - { max_depth=4, max_edges=50000 }
     * @returns {Promise<Object>} { found, from, to, hops, steps: [{ node, via_edge? }] }
     */
    async findPath(fromRef, toRef, options = {}) {
        const { max_depth = 4, max_edges = 50000 } = options;
        const from = await this.getEntity(fromRef);
        const to = await this.getEntity(toRef);
        if (!from || !to) {
            return { found: false, from, to, hops: 0, steps: [] };
        }
        if (from.id === to.id) {
            return { found: true, from, to, hops: 0, steps: [{ node: from }] };
        }
        let edges;
        try {
            edges = this._all(
                `SELECT id, source_id, target_id, type FROM edges LIMIT ?`,
                [max_edges],
            );
        } catch {
            return { found: false, from, to, hops: 0, steps: [] };
        }
        const adjacency = new Map();
        for (const e of edges) {
            if (!adjacency.has(e.source_id)) adjacency.set(e.source_id, []);
            if (!adjacency.has(e.target_id)) adjacency.set(e.target_id, []);
            adjacency.get(e.source_id).push({ next: e.target_id, edge: e });
            adjacency.get(e.target_id).push({ next: e.source_id, edge: e });
        }
        // BFS with parent pointers.
        const visited = new Map([[from.id, null]]);
        let frontier = [from.id];
        for (let depth = 0; depth < max_depth && frontier.length > 0; depth++) {
            const next = [];
            for (const nodeId of frontier) {
                for (const { next: nextId, edge } of adjacency.get(nodeId) ?? []) {
                    if (visited.has(nextId)) continue;
                    visited.set(nextId, { prev: nodeId, edge });
                    if (nextId === to.id) {
                        return this._materializePath(from, to, visited);
                    }
                    next.push(nextId);
                }
            }
            frontier = next;
        }
        return { found: false, from, to, hops: 0, steps: [] };
    }

    /** Walk parent pointers back from `to`, hydrating node rows. */
    _materializePath(from, to, visited) {
        const reversed = [];
        let cursor = to.id;
        while (cursor !== from.id) {
            const link = visited.get(cursor);
            reversed.push({ nodeId: cursor, edge: link.edge });
            cursor = link.prev;
        }
        const steps = [{ node: from }];
        for (const { nodeId, edge } of reversed.reverse()) {
            const node =
                this._get(`SELECT * FROM nodes WHERE id = ?`, [nodeId]) ?? {
                    id: nodeId,
                };
            steps.push({
                node,
                via_edge: {
                    id: edge.id,
                    type: edge.type,
                    source_id: edge.source_id,
                    target_id: edge.target_id,
                },
            });
        }
        return { found: true, from, to, hops: steps.length - 1, steps };
    }
}

/** A `CREATE TABLE` statement for a KB table's columns — the schema format
 *  LLMs are trained on for text-to-SQL. */
function buildCreateTableDDL(name, columns) {
    const cols = (columns || [])
        .map((c) => `  "${c.name}" ${c.type}`)
        .join(",\n");
    return `CREATE TABLE "${name}" (\n${cols}\n);`;
}
