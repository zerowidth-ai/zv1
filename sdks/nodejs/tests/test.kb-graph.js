/**
 * Regression tests for the knowledge-graph traversal path (Graph recipe,
 * ADR 0023). Run with: node tests/test.kb-graph.js (or via `npm run test-kb`).
 *
 * Self-contained: builds a tiny graph artifact (nodes + edges + the
 * _kb_tables registry rows the Graph recipe writes) and calls the
 * integration methods directly — no network dependency.
 *
 * Fixture graph:
 *
 *   Ada ──works_at──> Analytical Engines Inc ──located_in──> London
 *    │                                                          ▲
 *    └──────────mentored_by──> Babbage ──born_in───────────────┘
 *
 *   (+ an isolated node "Orphan" with no edges)
 */
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import SQLiteIntegration from "../src/integrations/sqlite.js";

let passed = 0;
function check(name, cond) {
  assert.ok(cond, name);
  console.log(`✅ ${name}`);
  passed++;
}

function buildDb() {
  const dir = mkdtempSync(join(tmpdir(), "kbgraphtest-"));
  const dbPath = join(dir, "g.db");
  const db = new DatabaseSync(dbPath);
  // Mirror the real graph artifact schema (kbGraph.buildGraphArtifact).
  db.exec(
    "CREATE TABLE nodes (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, description TEXT, document_id TEXT, created_at TEXT, updated_at TEXT);",
  );
  db.exec(
    "CREATE TABLE edges (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, target_id TEXT NOT NULL, type TEXT, description TEXT, document_id TEXT, created_at TEXT);",
  );
  db.exec(
    "CREATE TABLE _kb_tables (table_name TEXT PRIMARY KEY, source_name TEXT, row_count INTEGER, columns TEXT);",
  );
  const now = "2026-07-02T00:00:00Z";
  const node = db.prepare(
    "INSERT INTO nodes (id,name,type,description,document_id,created_at) VALUES (?,?,?,?,?,?)",
  );
  node.run("n-ada", "Ada", "person", "Mathematician", "d1", now);
  node.run("n-aei", "Analytical Engines Inc", "organization", null, "d1", now);
  node.run("n-london", "London", "place", null, "d1", now);
  node.run("n-babbage", "Babbage", "person", null, "d1", now);
  node.run("n-orphan", "Orphan", "concept", null, "d1", now);
  const edge = db.prepare(
    "INSERT INTO edges (id,source_id,target_id,type,description,document_id,created_at) VALUES (?,?,?,?,?,?,?)",
  );
  edge.run("e1", "n-ada", "n-aei", "works_at", null, "d1", now);
  edge.run("e2", "n-aei", "n-london", "located_in", null, "d1", now);
  edge.run("e3", "n-ada", "n-babbage", "mentored_by", null, "d1", now);
  edge.run("e4", "n-babbage", "n-london", "born_in", null, "d1", now);
  const reg = db.prepare(
    "INSERT INTO _kb_tables (table_name, source_name, row_count, columns) VALUES (?,?,?,?)",
  );
  reg.run("nodes", "graph", 5, JSON.stringify([{ name: "id", type: "TEXT" }, { name: "name", type: "TEXT" }]));
  reg.run("edges", "graph", 4, JSON.stringify([{ name: "id", type: "TEXT" }, { name: "source_id", type: "TEXT" }, { name: "target_id", type: "TEXT" }]));
  db.close();
  return dbPath;
}

async function main() {
  const dbPath = buildDb();
  const kb = new SQLiteIntegration(dbPath, { timeout: 5000 });
  await kb.connect();

  // listEntities — degree ordering + filters.
  const all = await kb.listEntities();
  check(`listEntities returns all nodes (got ${all.length})`, all.length === 5);
  check(
    `listEntities orders by degree desc (first is Ada or its peer, got "${all[0].name}" degree ${all[0].degree})`,
    all[0].degree === 2 && all[all.length - 1].name === "Orphan",
  );
  const people = await kb.listEntities({ type: "PERSON" });
  check(
    `listEntities type filter is case-insensitive (got ${people.length} people)`,
    people.length === 2,
  );
  const searched = await kb.listEntities({ search: "lond" });
  check(
    `listEntities search matches substring case-insensitively (got "${searched[0]?.name}")`,
    searched.length === 1 && searched[0].name === "London",
  );

  // getEntity — id then case-insensitive name.
  const byId = await kb.getEntity("n-ada");
  const byName = await kb.getEntity("ada");
  check("getEntity resolves by id", byId?.id === "n-ada");
  check("getEntity resolves by case-insensitive name", byName?.id === "n-ada");
  check("getEntity returns null for unknown ref", (await kb.getEntity("nope")) === null);

  // getNeighbors — direction + relation filters, far-node join.
  const both = await kb.getNeighbors("Ada");
  check(
    `getNeighbors both-directions returns 2 edges (got ${both.neighbors.length})`,
    both.neighbors.length === 2,
  );
  check(
    "getNeighbors joins the far node",
    both.neighbors.some((n) => n.node.name === "Analytical Engines Inc"),
  );
  const inbound = await kb.getNeighbors("London", { direction: "in" });
  check(
    `getNeighbors direction=in returns 2 for London (got ${inbound.neighbors.length})`,
    inbound.neighbors.length === 2 &&
      inbound.neighbors.every((n) => n.direction === "in"),
  );
  const typed = await kb.getNeighbors("Ada", { relation_type: "WORKS_AT" });
  check(
    "getNeighbors relation_type filter is case-insensitive",
    typed.neighbors.length === 1 &&
      typed.neighbors[0].relation_type === "works_at",
  );
  const missing = await kb.getNeighbors("nobody");
  check(
    "getNeighbors soft-fails for unknown entity",
    missing.entity === null && missing.neighbors.length === 0,
  );

  // findPath — BFS shortest path, name resolution, depth cap.
  const path = await kb.findPath("Ada", "London");
  check(
    `findPath finds the 2-hop path (got ${path.hops} hops)`,
    path.found && path.hops === 2 && path.steps.length === 3,
  );
  check(
    "findPath steps carry via_edge metadata",
    path.steps[1].via_edge != null && path.steps[0].via_edge === undefined,
  );
  const self = await kb.findPath("Ada", "ada");
  check("findPath same entity → 0 hops", self.found && self.hops === 0);
  const unreachable = await kb.findPath("Ada", "Orphan");
  check("findPath unreachable → found:false", unreachable.found === false);
  const depthCapped = await kb.findPath("Ada", "London", { max_depth: 1 });
  check("findPath respects max_depth", depthCapped.found === false);

  // Registry integration — graph tables are describable/queryable.
  const tables = await kb.listTables();
  check(
    `listTables sees the graph registry rows (got ${tables.map((t) => t.table_name).join(",")})`,
    tables.length === 2 && tables.some((t) => t.table_name === "nodes"),
  );

  await kb.disconnect();
  console.log(`\n${passed} checks passed`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
