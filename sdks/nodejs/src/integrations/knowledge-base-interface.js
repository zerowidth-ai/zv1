/**
 * Standard interface for knowledge base integrations
 * All knowledge base integrations must implement this interface
 * to ensure compatibility across different backends (SQLite, Pinecone, Weaviate, etc.)
 */

export class KnowledgeBaseInterface {
  /**
   * Execute a raw query against the knowledge base
   * @param {string} query - SQL or query string
   * @param {Array} params - Query parameters
   * @param {string} operation - Type of operation (SELECT, INSERT, UPDATE, DELETE)
   * @returns {Promise<Object>} Query result
   */
  async query(query, params = [], operation = 'SELECT') {
    throw new Error('query() method must be implemented by knowledge base integration');
  }

  /**
   * Execute a SELECT query
   * @param {string} query - SQL SELECT query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} Query results
   */
  async select(query, params = []) {
    throw new Error('select() method must be implemented by knowledge base integration');
  }

  /**
   * Execute an INSERT query
   * @param {string} query - SQL INSERT query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Insert result with lastID
   */
  async insert(query, params = []) {
    throw new Error('insert() method must be implemented by knowledge base integration');
  }

  /**
   * Execute an UPDATE query
   * @param {string} query - SQL UPDATE query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Update result with changes count
   */
  async update(query, params = []) {
    throw new Error('update() method must be implemented by knowledge base integration');
  }

  /**
   * Execute a DELETE query
   * @param {string} query - SQL DELETE query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Delete result with changes count
   */
  async delete(query, params = []) {
    throw new Error('delete() method must be implemented by knowledge base integration');
  }

  /**
   * Perform semantic search using vector similarity
   * @param {string} query - Text query to search for
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.similarity_threshold - Minimum similarity score
   * @param {string} options.document_id - Filter by specific document
   * @returns {Promise<Array>} Search results with similarity scores
   */
  async semanticSearch(query, options = {}) {
    throw new Error('semanticSearch() method must be implemented by knowledge base integration');
  }

  /**
   * Get the embedding model used by this knowledge base
   * @returns {Promise<string>} Embedding model name
   */
  async getEmbeddingModel() {
    throw new Error('getEmbeddingModel() method must be implemented by knowledge base integration');
  }

  /**
   * Get basic statistics about the knowledge base
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    throw new Error('getStats() method must be implemented by knowledge base integration');
  }

  /**
   * Validate the knowledge base schema
   * @returns {Promise<Object>} Validation result
   */
  async validateSchema() {
    throw new Error('validateSchema() method must be implemented by knowledge base integration');
  }

  /**
   * Get database schema information
   * @returns {Promise<Object>} Schema information
   */
  async getSchema() {
    throw new Error('getSchema() method must be implemented by knowledge base integration');
  }

  /**
   * Connect to the knowledge base
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('connect() method must be implemented by knowledge base integration');
  }

  /**
   * Disconnect from the knowledge base and clean up resources
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() method must be implemented by knowledge base integration');
  }

  /**
   * Keyword (exact-match) search over chunk content.
   * @param {string} query @param {Object} options - { limit, document_id }
   * @returns {Promise<Array>} chunk-shaped rows
   */
  async keywordSearch(query, options = {}) {
    throw new Error('keywordSearch() method must be implemented by knowledge base integration');
  }

  /** List documents. @param {Object} options - { limit, offset } */
  async listDocuments(options = {}) {
    throw new Error('listDocuments() method must be implemented by knowledge base integration');
  }

  /** Page one document's chunks. @param {Object} options - { startIndex, limit } */
  async getChunks(documentId, options = {}) {
    throw new Error('getChunks() method must be implemented by knowledge base integration');
  }

  /** One chunk plus its neighbors. @param {Object} options - { before, after } */
  async getChunkWindow(documentId, chunkIndex, options = {}) {
    throw new Error('getChunkWindow() method must be implemented by knowledge base integration');
  }

  /** Tabular registry: table schemas + sample rows. @param {Object} options - { sampleLimit } */
  async listTables(options = {}) {
    throw new Error('listTables() method must be implemented by knowledge base integration');
  }

  /** Graph: entities, most-connected first. @param {Object} options - { limit, offset, type, search } */
  async listEntities(options = {}) {
    throw new Error('listEntities() method must be implemented by knowledge base integration');
  }

  /** Graph: resolve an entity by id or case-insensitive name. */
  async getEntity(ref) {
    throw new Error('getEntity() method must be implemented by knowledge base integration');
  }

  /** Graph: relations touching an entity. @param {Object} options - { direction, relation_type, limit } */
  async getNeighbors(entityRef, options = {}) {
    throw new Error('getNeighbors() method must be implemented by knowledge base integration');
  }

  /** Graph: shortest relation chain between two entities. @param {Object} options - { max_depth } */
  async findPath(fromRef, toRef, options = {}) {
    throw new Error('findPath() method must be implemented by knowledge base integration');
  }
}
