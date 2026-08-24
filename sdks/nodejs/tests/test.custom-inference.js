// BYO custom inference endpoints (ADR 0048 Phase 3, zerowidth monorepo).
// End-to-end: a flow with a `custom-inference` node routes to a
// host-registered `customInferenceProviders` entry, and the OpenRouter
// integration omits OpenRouter-only payload fields for custom dialects.
//
// The upstream HTTP call is faked by monkeypatching the integration's
// OpenAI client after engine.create (the streaming client makes a real
// mock server heavy; this exercises loading, routing, settings
// resolution, streaming parse, and output mapping).

import assert from "assert";
import Workbench from "../src/index.js";
import OpenRouterIntegration from "../src/integrations/openrouter.js";
import { loadIntegrations } from "../src/utilities/loaders.js";

let failures = 0;
function check(name, fn) {
  return fn().then(
    () => console.log(`  ✓ ${name}`),
    (err) => {
      failures++;
      console.error(`  ✗ ${name}\n    ${err.message}`);
    },
  );
}

function fakeStream(chunks) {
  return (async function* () {
    for (const c of chunks) yield c;
  })();
}

const CONTENT_CHUNKS = [
  { object: "chat.completion.chunk", choices: [{ delta: { role: "assistant", content: "Hello world" }, finish_reason: null }] },
  { object: "chat.completion.chunk", choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } },
];

const flow = {
  nodes: [
    { id: "in", type: "input-data", settings: { key: "text" } },
    { id: "llm", type: "custom-inference", settings: { provider: "acme", model: "llama-3.1-70b" } },
    { id: "out", type: "output-data", settings: { key: "answer" } },
  ],
  links: [
    { from: { node_id: "in", port_name: "value" }, to: { node_id: "llm", port_name: "messages" } },
    { from: { node_id: "llm", port_name: "content" }, to: { node_id: "out", port_name: "value" } },
  ],
};

console.log("custom-inference:");

await check("dialect: openai keeps a plain OpenAI client baseURL", async () => {
  const i = new OpenRouterIntegration("k", { dialect: "openai", baseURL: "https://acme.example/v1" });
  assert.equal(i.dialect, "openai");
  assert.equal(i.client.baseURL, "https://acme.example/v1");
});

await check("dialect: azure builds an AzureOpenAI client", async () => {
  const i = new OpenRouterIntegration("k", { dialect: "azure", baseURL: "https://acme.openai.azure.com", apiVersion: "2024-10-21" });
  assert.equal(i.dialect, "azure");
  assert.equal(i.constructor.name, "OpenRouterIntegration");
  // AzureOpenAI extends OpenAI — the client is constructed without throwing.
  assert.ok(i.client);
});

await check("custom dialect omits OpenRouter-only payload fields", async () => {
  const i = new OpenRouterIntegration("k", { dialect: "openai", baseURL: "https://acme.example/v1" });
  let captured = null;
  i.client.chat.completions.create = async (payload) => {
    captured = payload;
    return fakeStream(CONTENT_CHUNKS);
  };
  const res = await i.chatCompletion(
    { model: "llama-3.1-70b", messages: [{ role: "user", content: "hi" }] },
    { type: "custom-inference", id: "llm" },
    {},
  );
  assert.equal(res.content, "Hello world");
  assert.equal(captured.model, "llama-3.1-70b");
  assert.ok(!("provider" in captured), "provider must not be sent to a custom endpoint");
  assert.ok(!("usage" in captured), "usage:{include} must not be sent to a custom endpoint");
});

await check("end-to-end flow routes through the custom provider", async () => {
  const engine = await Workbench.create(flow, {
    customInferenceProviders: {
      acme: { baseURL: "https://acme.example/v1", apiKey: "k", dialect: "openai", models: ["llama-3.1-70b"] },
    },
    knowledgeBase: { enabled: false },
  });
  const integration = engine.config.integrations["custom:acme"];
  assert.ok(integration, "custom:acme integration should be built");
  integration.client.chat.completions.create = async () => fakeStream(CONTENT_CHUNKS);

  const outputs = await engine.run({ text: "hi" });
  const answer = JSON.stringify(outputs);
  assert.ok(answer.includes("Hello world"), `expected output to include the completion, got ${answer}`);
});

const noKb = { knowledgeBase: { enabled: false } };

await check("generic inferenceBaseURL + keys.inference wires a plain OpenAI endpoint", async () => {
  const ints = await loadIntegrations({ ...noKb, keys: { inference: "k" }, inferenceBaseURL: "https://vllm.internal/v1" });
  assert.ok(ints.openrouter, "primary LLM integration should be built");
  assert.equal(ints.openrouter.client.baseURL, "https://vllm.internal/v1");
  assert.equal(ints.openrouter.dialect, "openai");
});

await check("legacy openrouterBaseURL + keys.openrouter is an equivalent alias", async () => {
  const ints = await loadIntegrations({ ...noKb, keys: { openrouter: "k" }, openrouterBaseURL: "https://vllm.internal/v1" });
  assert.equal(ints.openrouter.client.baseURL, "https://vllm.internal/v1");
  assert.equal(ints.openrouter.dialect, "openai");
});

await check("the default endpoint keeps the OpenRouter dialect + base", async () => {
  const ints = await loadIntegrations({ ...noKb, keys: { openrouter: "k" } });
  assert.equal(ints.openrouter.dialect, "openrouter");
  assert.ok(ints.openrouter.client.baseURL.includes("openrouter.ai"));
});

await check("an explicit OpenRouter base URL still keeps full accounting", async () => {
  const ints = await loadIntegrations({ ...noKb, keys: { inference: "k" }, inferenceBaseURL: "https://openrouter.ai/api/v1" });
  assert.equal(ints.openrouter.dialect, "openrouter");
});

if (failures > 0) {
  console.error(`\n${failures} custom-inference test(s) failed`);
  process.exit(1);
}
console.log("custom-inference: all passed");
