/**
 * Regression test: assistant text emitted alongside tool calls must survive
 * the engine's tool loop. Run with: node tests/test.tool-loop-content.js
 *
 * Bug: processLLMNode built the next-round assistant message as
 * { role, content: null, tool_calls } — discarding any narration the model
 * streamed before calling its tools ("Let me search for that!"). The text
 * was lost from (a) the messages sent back to the model on subsequent
 * rounds and (b) the final conversation output, even though it had already
 * been streamed to the user.
 *
 * Self-contained: openrouter + firecrawl integrations are faked, so this
 * exercises the real engine loop (plugin tool schema → tool call → macro
 * runner → follow-up round) with no network dependency.
 */
import assert from "node:assert";

import Workbench from "../src/index.js";

const TOOL_NARRATION = "Let me search for that!";
const FINAL_ANSWER = "Here's what I found about Duolingo.";

let passed = 0;
function check(name, cond) {
  assert.ok(cond, name);
  console.log(`✅ ${name}`);
  passed++;
}

// Fake OpenRouter: round 1 answers with narration + a tool call against
// whatever search tool the engine advertised; round 2 answers with text only.
// Captures each round's request so we can assert on what the model was sent.
function fakeOpenrouter(rounds) {
  return {
    chatCompletion: async (params) => {
      rounds.push(params);
      const sawToolResult = params.messages.some((m) => m.role === "tool");
      if (!sawToolResult) {
        const searchTool = (params.tools || []).find((t) =>
          (t.name || "").toLowerCase().includes("search"),
        );
        assert.ok(searchTool, "engine should advertise the search-internet plugin as a tool");
        return {
          role: "assistant",
          content: TOOL_NARRATION,
          tool_calls: [
            {
              id: "call_1",
              index: 0,
              type: "function",
              function: { name: searchTool.name, arguments: '{"query": "Duolingo press release"}' },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        };
      }
      return {
        role: "assistant",
        content: FINAL_ANSWER,
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    },
  };
}

const fakeFirecrawl = {
  search: async () => ({
    success: true,
    data: {
      web: [
        { url: "https://press.duolingo.com/", title: "Duolingo Press Room", description: "News.", position: 1 },
      ],
    },
  }),
};

const flow = {
  nodes: [
    { id: "in1", type: "input-chat" },
    { id: "llm1", type: "anthropic-claude-haiku-4-5" },
    { id: "search1", type: "search-internet" },
    { id: "out1", type: "output-chat" },
  ],
  links: [
    { from: { node_id: "in1", port_name: "messages" }, to: { node_id: "llm1", port_name: "messages" } },
    { from: { node_id: "llm1", port_name: "conversation" }, to: { node_id: "out1", port_name: "message" } },
    { from: { node_id: "search1" }, to: { node_id: "llm1" }, type: "plugin" },
  ],
  metadata: { mode: "agent" },
};

const rounds = [];
const engine = await Workbench.create(flow, {
  debug: false,
  keys: { openrouter: "test", firecrawl: "test" },
  integrations: { openrouter: fakeOpenrouter(rounds), firecrawl: fakeFirecrawl },
});

const result = await engine.run({ chat: [{ role: "user", content: "any duolingo press releases?" }] });
const chat = result.outputs.chat;

check("flow completes with two LLM rounds", rounds.length === 2);
check("final output has a chat conversation", Array.isArray(chat) && chat.length >= 3);

const toolCallTurn = chat.find((m) => m.role === "assistant" && Array.isArray(m.tool_calls));
check("conversation includes the assistant tool-call turn", !!toolCallTurn);
check(
  "tool-call turn keeps the narration text (was: content dropped to null)",
  toolCallTurn.content === TOOL_NARRATION,
);

const finalTurn = chat[chat.length - 1];
check("final assistant turn carries the follow-up answer", finalTurn.content === FINAL_ANSWER);

const round2ToolCallMsg = rounds[1].messages.find(
  (m) => m.role === "assistant" && Array.isArray(m.tool_calls),
);
check("round 2 request includes the tool-call message", !!round2ToolCallMsg);
check(
  "model sees its own narration on the next round (was: content: null)",
  round2ToolCallMsg.content === TOOL_NARRATION,
);

const toolResultMsg = rounds[1].messages.find((m) => m.role === "tool");
check("round 2 request includes the tool result", !!toolResultMsg && toolResultMsg.tool_call_id === "call_1");

console.log(`\n✅ All ${passed} tool-loop content-preservation checks passed`);
