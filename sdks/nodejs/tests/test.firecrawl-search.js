/**
 * Unit tests for the firecrawl-search node (the Firecrawl-backed
 * replacement for google-custom-search behind the search-internet macro).
 * Run with: node tests/test.firecrawl-search.js
 *
 * Self-contained: the Firecrawl integration is faked so there's no
 * network dependency. Covers:
 *   - happy-path mapping of the v2 envelope ({ data: { web: [...] } })
 *     into the shared search-result shape (title/link/displayLink/snippet)
 *   - flat-array (v1-style) envelope fallback
 *   - limit coercion + clamping into Firecrawl's 1-100 range
 *   - empty results
 *   - API errors bubbling up untouched
 *   - missing-integration error
 *   - engine-level needs_key_from validation for both firecrawl-search
 *     and the repointed search-internet macro (requires a prior
 *     `python scripts/sync_sdks.py` so the engine sees the node)
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import Workbench from "../src/index.js";
import { getDirname } from "../src/utilities/helpers.js";

const nodeDir = path.join(getDirname(import.meta.url), "../nodes/firecrawl-search");
const nodeConfig = JSON.parse(
  fs.readFileSync(path.join(nodeDir, "firecrawl-search.config.json"), "utf-8"),
);
const process_ = await import(
  `file://${path.join(nodeDir, "firecrawl-search.process.js")}`
).then((m) => m.default);

let passed = 0;
function check(name, cond) {
  assert.ok(cond, name);
  console.log(`✅ ${name}`);
  passed++;
}

function fakeFirecrawl(response, capture = {}) {
  return {
    search: async (params) => {
      capture.params = params;
      if (response instanceof Error) throw response;
      return response;
    },
  };
}

async function run(inputs, firecrawl) {
  const integrations = firecrawl === undefined ? {} : { firecrawl };
  return process_({
    inputs,
    settings: {},
    config: { integrations },
    nodeConfig,
  });
}

// --- config declarations ------------------------------------------------

check(
  "config declares needs_key_from: ['firecrawl'] like firecrawl-scrape",
  JSON.stringify(nodeConfig.needs_key_from) === JSON.stringify(["firecrawl"]),
);
check(
  "config defaults limit to 5",
  nodeConfig.inputs.find((i) => i.name === "limit")?.default === 5,
);

// --- happy path: v2 envelope keyed by source ----------------------------

{
  const capture = {};
  const result = await run(
    { query: "zerowidth ai", limit: 2 },
    fakeFirecrawl(
      {
        success: true,
        data: {
          web: [
            {
              url: "https://zerowidth.ai/",
              title: "ZeroWidth",
              description: "Service as Software.",
              position: 1,
            },
            {
              url: "https://docs.firecrawl.dev/features/search",
              title: "Search | Firecrawl",
              description: "Search the web.",
              position: 2,
            },
          ],
        },
        warning: null,
      },
      capture,
    ),
  );

  check("happy path: sends query through", capture.params.query === "zerowidth ai");
  check("happy path: sends numeric limit through", capture.params.limit === 2);
  check("happy path: returns two items", result.items.length === 2);
  check("happy path: total_results matches", result.total_results === 2);
  check("happy path: warning is null", result.warning === null);
  assert.deepStrictEqual(
    result.items[0],
    {
      title: "ZeroWidth",
      link: "https://zerowidth.ai/",
      displayLink: "zerowidth.ai",
      snippet: "Service as Software.",
      position: 1,
    },
    "happy path: item maps title/link/displayLink/snippet/position",
  );
  check("happy path: item maps title/link/displayLink/snippet/position", true);
}

// --- flat-array (v1-style) envelope fallback -----------------------------

{
  const result = await run(
    { query: "fallback" },
    fakeFirecrawl({
      success: true,
      data: [{ url: "https://example.com/a", title: "A", description: "aaa" }],
    }),
  );
  check("flat-array envelope: still maps items", result.items.length === 1);
  check("flat-array envelope: position falls back to index+1", result.items[0].position === 1);
  check("flat-array envelope: displayLink derived from url", result.items[0].displayLink === "example.com");
}

// --- limit coercion + clamping -------------------------------------------

{
  const capture = {};
  await run({ query: "q", limit: "3" }, fakeFirecrawl({ data: { web: [] } }, capture));
  check("limit: numeric string coerced to number", capture.params.limit === 3);
}
{
  const capture = {};
  await run({ query: "q", limit: 500 }, fakeFirecrawl({ data: { web: [] } }, capture));
  check("limit: clamped to Firecrawl max of 100", capture.params.limit === 100);
}
{
  const capture = {};
  await run({ query: "q", limit: 0 }, fakeFirecrawl({ data: { web: [] } }, capture));
  check("limit: clamped up to minimum of 1", capture.params.limit === 1);
}
{
  const capture = {};
  await run({ query: "q" }, fakeFirecrawl({ data: { web: [] } }, capture));
  check("limit: omitted from request when not provided", !("limit" in capture.params));
}

// --- empty + missing results ----------------------------------------------

{
  const result = await run({ query: "no hits" }, fakeFirecrawl({ success: true, data: { web: [] } }));
  check("empty results: items is []", Array.isArray(result.items) && result.items.length === 0);
  check("empty results: total_results is 0", result.total_results === 0);
}
{
  const result = await run({ query: "no data key" }, fakeFirecrawl({ success: true }));
  check("missing data key: items is []", Array.isArray(result.items) && result.items.length === 0);
}

// --- API error bubbles up ---------------------------------------------------

{
  const apiError = new Error("Firecrawl API Error (402 Payment Required): Insufficient credits");
  await assert.rejects(
    run({ query: "q" }, fakeFirecrawl(apiError)),
    (err) => err.message === apiError.message,
    "API errors should bubble up untouched",
  );
  check("API error: bubbles up untouched", true);
}

// --- missing integration -----------------------------------------------------

{
  await assert.rejects(
    run({ query: "q" }, undefined),
    (err) => err.message === "Firecrawl integration not found",
    "missing integration should throw the standard message",
  );
  check("missing integration: throws 'Firecrawl integration not found'", true);
}

// --- engine-level needs_key_from validation ----------------------------------

async function expectMissingKey(flowNodeType) {
  const flow = {
    nodes: [
      { id: "in1", type: "input-data", settings: { key: "query" } },
      { id: "n1", type: flowNodeType },
      { id: "out1", type: "output-data", settings: { key: "results" } },
    ],
    links: [
      { from: { node_id: "in1", port_name: "value" }, to: { node_id: "n1", port_name: "query" } },
    ],
  };
  await assert.rejects(
    Workbench.create(flow, { debug: false, keys: {} }),
    (err) => err.message.includes("requires the following missing keys: firecrawl"),
    `${flowNodeType} without a firecrawl key should fail key validation`,
  );
  check(`needs_key_from: ${flowNodeType} without a firecrawl key fails validation`, true);
}

await expectMissingKey("firecrawl-search");
await expectMissingKey("search-internet");

console.log(`\n✅ All ${passed} firecrawl-search checks passed`);
