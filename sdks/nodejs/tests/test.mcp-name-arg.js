/**
 * Regression test: MCP tool arguments named `name` must survive.
 * Run with: node tests/test.mcp-name-arg.js
 *
 * Bug: tool identity and tool arguments were merged into one flat
 * object — the ln-node call site spread the model's arguments and set
 * `name` to the tool name (overwriting any argument named `name`),
 * then callMCPTool destructured `name` back off as the tool name
 * (stripping it from the forwarded arguments). Tools with a top-level
 * `name` parameter (caliper_datasets_create, caliper_rubrics_create)
 * received `name: undefined` and failed server-side Zod validation
 * with -32602. callMCPTool now takes { name, arguments } as distinct
 * fields end-to-end.
 *
 * Self-contained: a local node:http server plays the MCP endpoint
 * (tools/list + tools/call, JSON-RPC over plain JSON) and captures
 * every request body, so both the utility contract and the full
 * engine loop (plugin discovery → tool call → MCP request) are
 * exercised with no external network.
 */
import assert from "node:assert";
import http from "node:http";

import Workbench from "../src/index.js";
import { callMCPTool } from "../src/utilities/mcp.js";

let passed = 0;
function check(name, cond) {
  assert.ok(cond, name);
  console.log(`✅ ${name}`);
  passed++;
}

// ── Fake MCP server ────────────────────────────────────────────────
// Captures every JSON-RPC request; answers tools/list with one tool
// whose schema has a top-level `name` parameter, and tools/call with
// a success result.

const captured = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const payload = JSON.parse(body);
    captured.push(payload);
    const respond = (result) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result }));
    };
    if (payload.method === "tools/list") {
      respond({
        tools: [
          {
            name: "caliper_datasets_create",
            description: "Create a Caliper dataset.",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string" },
                items: { type: "array", items: { type: "string" } },
              },
              required: ["name"],
            },
          },
        ],
      });
      return;
    }
    if (payload.method === "tools/call") {
      respond({ content: [{ type: "text", text: "dataset created" }] });
      return;
    }
    respond({});
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const mcpUrl = `http://127.0.0.1:${server.address().port}/mcp`;

// ── Unit: callMCPTool forwards `arguments` verbatim ────────────────

const RICH_ARGS = {
  name: "Quarterly evals",
  items: ["a", "b"],
  criteria: { depth: 2, nested: { name: "inner name survives too" } },
  workspace: "acme",
};
await callMCPTool(
  { name: "caliper_datasets_create", arguments: RICH_ARGS },
  { url: mcpUrl },
);
const unitCall = captured.at(-1);
check("unit: request method is tools/call", unitCall.method === "tools/call");
check(
  "unit: params.name is the tool name",
  unitCall.params.name === "caliper_datasets_create",
);
check(
  "unit: arguments.name keeps the model-provided value (was: undefined)",
  unitCall.params.arguments.name === "Quarterly evals",
);
check(
  "unit: arguments forwarded byte-for-byte (no keys added or dropped)",
  JSON.stringify(unitCall.params.arguments) === JSON.stringify(RICH_ARGS),
);

// Omitted arguments → empty object on the wire, never undefined.
await callMCPTool({ name: "caliper_datasets_create" }, { url: mcpUrl });
check(
  "unit: omitted arguments ships {}",
  JSON.stringify(captured.at(-1).params.arguments) === "{}",
);

// Legacy flat-object shape fails loudly instead of dropping args.
await assert.rejects(
  () =>
    callMCPTool(
      { name: "caliper_datasets_create", items: ["a"] },
      { url: mcpUrl },
    ),
  /unexpected top-level keys: items/,
  "legacy flat-shape call should throw",
);
check("unit: legacy flat-shape call throws with a pointer to `arguments`", true);

await assert.rejects(
  () => callMCPTool({ arguments: {} }, { url: mcpUrl }),
  /No tool name provided/,
  "missing name should throw",
);
check("unit: missing tool name throws", true);

// ── Engine: full loop — LLM tool call → MCP request ───────────────
// Fake OpenRouter emits a tool call against the advertised MCP tool
// with an arguments payload containing a top-level `name`.

const MODEL_ARGS = { name: "Quarterly evals", items: ["run-1"] };
function fakeOpenrouter() {
  return {
    chatCompletion: async (params) => {
      const sawToolResult = params.messages.some((m) => m.role === "tool");
      if (!sawToolResult) {
        const tool = (params.tools || []).find(
          (t) => t.name === "caliper_datasets_create",
        );
        assert.ok(tool, "engine should advertise the MCP tool to the model");
        return {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              index: 0,
              type: "function",
              function: {
                name: "caliper_datasets_create",
                arguments: JSON.stringify(MODEL_ARGS),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        };
      }
      return {
        role: "assistant",
        content: "Created the dataset.",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    },
  };
}

const flow = {
  nodes: [
    { id: "in1", type: "input-chat" },
    { id: "llm1", type: "anthropic-claude-haiku-4-5" },
    { id: "mcp1", type: "remote-mcp-tool", settings: { mcp_integration: "zw" } },
    { id: "out1", type: "output-chat" },
  ],
  links: [
    { from: { node_id: "in1", port_name: "messages" }, to: { node_id: "llm1", port_name: "messages" } },
    { from: { node_id: "llm1", port_name: "conversation" }, to: { node_id: "out1", port_name: "message" } },
    { from: { node_id: "mcp1" }, to: { node_id: "llm1" }, type: "plugin" },
  ],
  metadata: { mode: "agent" },
};

const engine = await Workbench.create(flow, {
  debug: false,
  keys: {
    openrouter: "test",
    mcp: { zw: { url: mcpUrl, token: "test-token" } },
  },
  integrations: { openrouter: fakeOpenrouter() },
});

const capturedBefore = captured.length;
const result = await engine.run({
  chat: [{ role: "user", content: "make a dataset called Quarterly evals" }],
});

const engineCall = captured
  .slice(capturedBefore)
  .find((p) => p.method === "tools/call");
check("engine: a tools/call request reached the MCP server", !!engineCall);
check(
  "engine: params.name is the tool name",
  engineCall.params.name === "caliper_datasets_create",
);
check(
  "engine: arguments.name carries the model's value end-to-end (was: undefined)",
  engineCall.params.arguments.name === "Quarterly evals",
);
check(
  "engine: full arguments object forwarded verbatim",
  JSON.stringify(engineCall.params.arguments) === JSON.stringify(MODEL_ARGS),
);
const finalTurn = result.outputs.chat.at(-1);
check(
  "engine: flow completes after the tool round",
  finalTurn.content === "Created the dataset.",
);

server.close();
console.log(`\n✅ All ${passed} MCP name-argument checks passed`);
