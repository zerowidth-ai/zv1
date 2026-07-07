# Changelog

## Unreleased

- **`search-internet` is backed by Firecrawl Search.** Google's Custom Search JSON API is closed to new customers, so the macro now wraps a new `firecrawl-search` node (`POST /v2/search`) and requires a `firecrawl` key instead of `google_custom_search`. The macro's surface is unchanged: `query` in, `results` out — an array of `{ title, link, displayLink, snippet }` (each item also carries `position`). Default result count is 5 (was 10).
- New vendor node `firecrawl-search`: `query` + `limit` (default 5, clamped 1–100) in; `items` / `total_results` / `warning` out. `FirecrawlIntegration` gains a matching `search()` method (JS + Python).
- `google-custom-search` is unchanged for existing keys, but its backing API is unprocurable for new customers.

## 2.0.0 — 2026-07

First stable release of `@zerowidth/workbench-sdk` (successor to the `zv1` package — drop-in: same `Workbench` API).

### Knowledge bases
- Full knowledge-node family: `semantic-search`, `keyword-search`, `query-knowledge-base`, `describe-tables`, `list-documents`, `read-chunks`, `expand-chunk-context`, `get-chunk-by-index`, `combine-document-chunks` — plus graph traversal: `list-entities`, `get-entity-neighbors`, `find-entity-path`.
- Per-node knowledge bases: a `knowledge-base` node binds a specific KB to specific search nodes (`flow.knowledgeDbPaths`, keyed by uuid), alongside the flow-global KB.
- **Bring your own knowledge base**: pass any object implementing the exported `KnowledgeBaseInterface` via `config.knowledgeBase.instance` (flow-global) or `config.knowledgeBase.instances[kbUuid]` — run flows against your own SQL database, vector store, or service. The interface now declares every method knowledge nodes call.

### Fixes
- **Nested imports (import-within-import) resolve for the first time.** A spread-order bug in the `.zv1` loader clobbered each import's loaded nested-definitions array with the raw `{id: snapshot}` request map, so second-level imports silently never registered (empty outputs pre-2.0; unknown-node-type error under the new loud validation). Caught by the new `flow.nested-imports.zv1` test.
- **Unknown node types now fail at load.** `Workbench.create` throws `Flow references unknown node type(s): …` when a flow names a node type that isn't in the catalog (removed model, typo, missing import). Previously the node silently never executed and the flow "completed" with empty outputs.
- **Imported subflows are callable as LLM tools again.** The `zv1 → Workbench` class rename left a stale reference in the import-to-node-type converter, so every imported-flow tool call failed at runtime with `Workbench is not defined`. Covered by the new `flow.chat-tool-chain.zv1` test (two dependent sequential tool calls).
- **`disconnect()` no longer deletes database files by path heuristic.** File lifecycle belongs to the creator: the engine cleans its own temp extractions; hosts opt in to cleanup of paths they provide with `config.knowledgeBase.cleanupDbFiles: true`. (Previously, a path merely containing `knowledge_` or `.temp` was unlinked after every run.)
- `query()` routes only true `LIMIT 1` statements to single-row mode — `LIMIT 10`/`LIMIT 100` return full result sets.
- Host-injected knowledge-base instances are never clobbered by file-path registrations; per-uuid registration runs regardless of a global instance.
- Python `query-knowledge-base` node gains the per-uuid resolver and 1000-row result cap matching the JS variant.

### Also
- `keyword-search`, `list-documents`, and `read-chunks` are callable as LLM tools (`is_plugin`).
- `node:sqlite` + loadable `sqlite-vec` — no native module builds.
