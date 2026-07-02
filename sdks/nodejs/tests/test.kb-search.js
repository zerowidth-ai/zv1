/**
 * Regression tests for the SQLite knowledge-base search path (ADR 0023).
 * Run with: node tests/test.kb-search.js  (or `npm run test-kb`)
 *
 * These lock in the "silent zero results" bugs we hit live:
 *   - getEmbeddingModel() must return the STORED (namespaced) model, not the
 *     hardcoded non-namespaced fallback — otherwise semanticSearch's
 *     `WHERE embedding_model = ?` filter drops every row.
 *   - semanticSearch returns a matching chunk at threshold 0 when model + dims
 *     agree (and honors the distance→threshold conversion).
 *   - keywordSearch matches case-insensitively, ranks by occurrence count, and
 *     returns nothing for a term that isn't present.
 *
 * Self-contained: builds a tiny sqlite artifact and passes the query embedding
 * directly, so there's no network / OpenRouter dependency.
 */
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import SQLiteIntegration from "../src/integrations/sqlite.js";

const MODEL = "openai/text-embedding-3-small";
let passed = 0;
function check(name, cond) {
  assert.ok(cond, name);
  console.log(`✅ ${name}`);
  passed++;
}

function buildDb() {
  const dir = mkdtempSync(join(tmpdir(), "kbtest-"));
  const dbPath = join(dir, "k.db");
  const db = new DatabaseSync(dbPath, { allowExtension: true });
  db.exec(
    "CREATE TABLE documents (id TEXT PRIMARY KEY, display_name TEXT, file_type TEXT, folder_path TEXT);",
  );
  db.exec(
    "CREATE TABLE chunks (id TEXT PRIMARY KEY, document_id TEXT, chunk_index INTEGER, content TEXT, token_count INTEGER, chunk_type TEXT, metadata TEXT, embedding TEXT, embedding_model TEXT, embedding_dimensions INTEGER, created_at TEXT, updated_at TEXT);",
  );
  db.prepare("INSERT INTO documents VALUES (?,?,?,?)").run("d1", "bio.md", "md", null);
  const insert = db.prepare(
    "INSERT INTO chunks (id,document_id,chunk_index,content,embedding,embedding_model,embedding_dimensions,created_at) VALUES (?,?,?,?,?,?,?,?)",
  );
  // c0: near the query vector [1,0,0,0]; c1: orthogonal-ish.
  insert.run("c0", "d1", 0, "The cell is the basic unit. The cell membrane surrounds the cell.", JSON.stringify([0.99, 0.1, 0, 0]), MODEL, 4, "2026-07-02T00:00:00Z");
  insert.run("c1", "d1", 1, "Photosynthesis occurs in the chloroplast.", JSON.stringify([0, 1, 0, 0]), MODEL, 4, "2026-07-02T00:01:00Z");
  db.close();
  return dbPath;
}

async function main() {
  const dbPath = buildDb();
  const kb = new SQLiteIntegration(dbPath, { timeout: 5000 });
  await kb.connect();

  // 1. getEmbeddingModel returns the stored namespaced model (not the fallback).
  const model = await kb.getEmbeddingModel();
  check(
    `getEmbeddingModel returns stored namespaced model (got "${model}")`,
    model === MODEL,
  );

  // 2. semanticSearch returns a match at threshold 0 with matching model/dims,
  //    ranked closest-first.
  const sem = await kb.semanticSearch("anything", {
    similarity_threshold: 0,
    embedding_model: model,
    query_embedding: [1, 0, 0, 0],
  });
  check(`semanticSearch@0 returns results (got ${sem.length})`, sem.length >= 1);
  check("semanticSearch ranks the closest chunk first", sem[0].id === "c0");
  check(
    "semanticSearch reports a similarity_score",
    typeof sem[0].similarity_score === "number",
  );

  // 3. A mismatched query model filters everything out (documents the guard).
  const mismatch = await kb.semanticSearch("anything", {
    similarity_threshold: 0,
    embedding_model: "some/other-model",
    query_embedding: [1, 0, 0, 0],
  });
  check("semanticSearch drops rows on model mismatch", mismatch.length === 0);

  // 4. keywordSearch: case-insensitive, ranked by occurrence count.
  const kw = await kb.keywordSearch("CELL", { limit: 10 });
  check(`keywordSearch is case-insensitive (got ${kw.length})`, kw.length === 1);
  check("keywordSearch returns the matching chunk", kw[0].id === "c0");
  check("keywordSearch counts occurrences (3x 'cell')", kw[0].match_count === 3);

  // 5. keywordSearch returns nothing for an absent term.
  const none = await kb.keywordSearch("quantum", { limit: 10 });
  check("keywordSearch returns [] for no match", none.length === 0);

  await kb.disconnect();
  console.log(`\n${passed} checks passed.`);
}

main().catch((err) => {
  console.error("❌ test.kb-search failed:", err);
  process.exit(1);
});
