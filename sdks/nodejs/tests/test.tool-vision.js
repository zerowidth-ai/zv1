/**
 * Regression tests for image-bearing tool results in the engine tool loop.
 * Run with: node tests/test.tool-vision.js
 *
 * Self-contained: openrouter is faked (no network), the ShowImage tool
 * comes from the flow.chat-tool-image.zv1 fixture's imported subflow.
 *
 * Covers both halves of the wire/durable split:
 *   1. Single round — the model request carries the pixels as an
 *      image_url vision message placed above the tool cycle, the
 *      role:"tool" message carries a text note instead of base64, and
 *      the vision message never leaks into the conversation output.
 *   2. Multi-round — a vision message in the FINAL round must not stop
 *      the conversation walk early: every earlier tool cycle (and its
 *      narration text) survives into the output. This was the review
 *      finding on the first cut, where vision placement adjacent to the
 *      last cycle cut all earlier cycles out of the final conversation.
 */
import assert from "node:assert";
import path from "node:path";

import Workbench from "../src/index.js";
import { getDirname } from "../src/utilities/helpers.js";

const FIXTURE = path.join(getDirname(import.meta.url), "flows/flow.chat-tool-image.zv1");

let passed = 0;
function check(name, cond) {
  assert.ok(cond, name);
  console.log(`✅ ${name}`);
  passed++;
}

// Scripted fake: calls ShowImage `toolRounds` times (with narration each
// round), then answers. Captures every request for wire assertions.
function fakeOpenrouter(toolRounds, requests) {
  let round = 0;
  return {
    chatCompletion: async (params) => {
      requests.push(params);
      round++;
      if (round <= toolRounds) {
        return {
          role: "assistant",
          content: `Round ${round}: calling ShowImage.`,
          tool_calls: [
            {
              id: `call_${round}`,
              index: 0,
              type: "function",
              function: { name: "ShowImage", arguments: "{}" },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        };
      }
      return {
        role: "assistant",
        content: "red",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    },
  };
}

async function runFlow(toolRounds, requests) {
  const engine = await Workbench.create(FIXTURE, {
    debug: false,
    keys: { openrouter: "test" },
    integrations: { openrouter: fakeOpenrouter(toolRounds, requests) },
  });
  return engine.run({ chat: [{ role: "user", content: "what color is the image?" }] });
}

const isVisionMessage = (m) =>
  m.role === "user" &&
  Array.isArray(m.content) &&
  m.content.some((p) => p && p.type === "image_url");

// --- 1. single round: wire shape + durable record + no leak ---------------

{
  const requests = [];
  const result = await runFlow(1, requests);
  const chat = result.outputs.chat;

  const round2 = requests[1].messages;
  const visionIdx = round2.findIndex(isVisionMessage);
  const cycleIdx = round2.findIndex((m) => m.role === "assistant" && m.tool_calls);
  check("wire: vision message present in the follow-up request", visionIdx !== -1);
  check(
    "wire: vision message carries the actual pixels as a data URI",
    JSON.stringify(round2[visionIdx]).includes("data:image/png;base64,"),
  );
  check("wire: vision message sits above the tool cycle", visionIdx < cycleIdx);

  const wireToolMsg = round2.find((m) => m.role === "tool");
  check(
    "wire: tool message carries a note, not base64",
    wireToolMsg.content.includes("delivered to the model as a vision input") &&
      !wireToolMsg.content.includes("base64"),
  );

  const outToolMsg = chat.find((m) => m.role === "tool");
  check(
    "output: tool message is byte-identical to the wire record",
    outToolMsg.content === wireToolMsg.content,
  );
  check("output: no vision message leaks into the conversation", !chat.some(isVisionMessage));
  check("output: full tool cycle survives", chat.some((m) => m.role === "assistant" && m.tool_calls));
}

// --- 2. multi-round: earlier cycles survive a final-round image -----------

{
  const requests = [];
  const result = await runFlow(2, requests);
  const chat = result.outputs.chat;
  const serialized = JSON.stringify(chat);

  check("multi-round: cycle 1 (call_1) survives in the output", serialized.includes("call_1"));
  check("multi-round: cycle 2 (call_2) survives in the output", serialized.includes("call_2"));
  check(
    "multi-round: round-1 narration text survives",
    serialized.includes("Round 1: calling ShowImage."),
  );
  check("multi-round: no vision message leaks", !chat.some(isVisionMessage));

  // The final request must still place its vision message above BOTH
  // cycles (durable cycle 1 + wire cycle 2), not wedged between them.
  const round3 = requests[2].messages;
  const visionIdx = round3.findIndex(isVisionMessage);
  const firstCycleIdx = round3.findIndex((m) => m.role === "tool" || (m.role === "assistant" && m.tool_calls));
  check("multi-round wire: vision message sits above the entire cycle run", visionIdx !== -1 && visionIdx <= firstCycleIdx);
}

console.log(`\n✅ All ${passed} tool-vision checks passed`);
