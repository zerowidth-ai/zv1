/**
 * Regression test: tool-call node events must carry the model-invoked
 * tool name + tool-call id.
 * Run with: node tests/test.tool-call-events.js
 *
 * Bug: onNodeStart / onNodeComplete / onNodeError around MCP tool
 * dispatch only carried nodeId + nodeType — the integration node,
 * which is shared by every tool on that MCP server. A live-trace UI
 * couldn't label a per-tool chip or pair start → complete/error
 * across a multi-round loop. The events now additionally carry
 * `toolName` (model-invoked name) and `toolCallId` (tool_call.id),
 * on the success, execution-error, and invalid-args paths alike.
 *
 * Self-contained: local node:http MCP server (one tool that fails on
 * demand) + faked OpenRouter emitting two tool calls in one round.
 */
import assert from "node:assert";
import http from "node:http";

import Workbench from "../src/index.js";

let passed = 0;
function check(name, cond) {
  assert.ok(cond, name);
  console.log(`✅ ${name}`);
  passed++;
}

// ── Fake MCP server ────────────────────────────────────────────────
// tools/call succeeds unless the arguments carry `fail: true`, in
// which case it answers a JSON-RPC error (→ callMCPTool throws → the
// engine's execution-error path).

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const payload = JSON.parse(body);
    const respond = (obj) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id, ...obj }));
    };
    if (payload.method === "tools/list") {
      respond({
        result: {
          tools: [
            {
              name: "caliper_datasets_create",
              description: "Create a Caliper dataset.",
              inputSchema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  fail: { type: "boolean" },
                },
              },
            },
          ],
        },
      });
      return;
    }
    if (payload.method === "tools/call") {
      if (payload.params.arguments?.fail === true) {
        respond({ error: { code: -32000, message: "simulated tool failure" } });
      } else {
        respond({ result: { content: [{ type: "text", text: "ok" }] } });
      }
      return;
    }
    respond({ result: {} });
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const mcpUrl = `http://127.0.0.1:${server.address().port}/mcp`;

// ── Fake OpenRouter — one round with two tool calls (one succeeds,
// one fails), then a closing text round. ───────────────────────────

function fakeOpenrouter() {
  return {
    chatCompletion: async (params) => {
      const sawToolResult = params.messages.some((m) => m.role === "tool");
      if (!sawToolResult) {
        return {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_ok",
              index: 0,
              type: "function",
              function: {
                name: "caliper_datasets_create",
                arguments: JSON.stringify({ name: "Quarterly evals" }),
              },
            },
            {
              id: "call_bad",
              index: 1,
              type: "function",
              function: {
                name: "caliper_datasets_create",
                arguments: JSON.stringify({ name: "Doomed", fail: true }),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        };
      }
      return {
        role: "assistant",
        content: "Done.",
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

// Capture every node event; tool-call events are the remote-mcp-tool
// ones (regular nodes fire the same hooks without toolName).
const started = [];
const completed = [];
const errored = [];
const engine = await Workbench.create(flow, {
  debug: false,
  keys: {
    openrouter: "test",
    mcp: { zw: { url: mcpUrl, token: "test-token" } },
  },
  integrations: { openrouter: fakeOpenrouter() },
  onNodeStart: (e) => {
    if (e.nodeType === "remote-mcp-tool") started.push(e);
  },
  onNodeComplete: (e) => {
    if (e.nodeType === "remote-mcp-tool") completed.push(e);
  },
  onNodeError: (e) => {
    if (e.nodeType === "remote-mcp-tool") errored.push(e);
  },
});

await engine.run({
  chat: [{ role: "user", content: "make two datasets" }],
});

check("both tool calls fire onNodeStart", started.length === 2);
check(
  "start events carry the model tool name",
  started.every((e) => e.toolName === "caliper_datasets_create"),
);
check(
  "start events carry distinct tool-call ids",
  started[0].toolCallId === "call_ok" && started[1].toolCallId === "call_bad",
);
check(
  "start events keep nodeId/nodeType/inputs (additive change)",
  started.every(
    (e) => e.nodeId === "mcp1" && e.nodeType === "remote-mcp-tool" && !!e.inputs,
  ),
);

check("successful call fires onNodeComplete", completed.length === 1);
check(
  "complete event pairs back to its start via toolCallId",
  completed[0].toolCallId === "call_ok" &&
    completed[0].toolName === "caliper_datasets_create",
);
check(
  "complete event keeps inputs + outputs",
  completed[0].inputs.name === "Quarterly evals" &&
    !!completed[0].outputs?.result,
);

check("failed call fires onNodeError", errored.length === 1);
check(
  "error event pairs back to its start via toolCallId",
  errored[0].toolCallId === "call_bad" &&
    errored[0].toolName === "caliper_datasets_create",
);
check(
  "error event keeps nodeId/nodeType/error",
  errored[0].nodeId === "mcp1" &&
    errored[0].nodeType === "remote-mcp-tool" &&
    /simulated tool failure/.test(errored[0].error?.message ?? ""),
);

server.close();
console.log(`\n✅ All ${passed} tool-call event checks passed`);
