/**
 * Regression test for the idle watchdog (config.idleTimeoutMs).
 * Run with: node tests/test.idle-timeout.js
 *
 * The flow timeout is a wall-clock cap on the whole run — one budget
 * that a multi-round agent legitimately eats with many quick steps.
 * The idle watchdog instead bounds time-without-progress: node
 * boundaries, tool dispatch/settle, and token deltas all stamp
 * activity, and only silence longer than idleTimeoutMs aborts.
 *
 * Covers: (1) a flow whose TOTAL duration far exceeds the idle window
 * still completes as long as each step keeps stamping progress,
 * (2) a hung node dies at ~idle instead of running to the wall cap,
 * (3) without idleTimeoutMs behavior is unchanged (wall cap only).
 *
 * Deterministic & offline: node processes are stubbed — no network.
 */
import assert from 'assert';
import Workbench from '../src/index.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** input-data → abs1 → abs2 → abs3 → abs4 → abs5 → output-data */
function chainFlow() {
  const nodes = [
    { id: 'in', type: 'input-data', settings: { key: 'x' } },
    ...[1, 2, 3, 4, 5].map((i) => ({ id: `abs${i}`, type: 'absolute' })),
    { id: 'out', type: 'output-data', settings: { key: 'out' } },
  ];
  const links = [
    { from: { node_id: 'in', port_name: 'value' }, to: { node_id: 'abs1', port_name: 'number' } },
    ...[1, 2, 3, 4].map((i) => ({
      from: { node_id: `abs${i}`, port_name: 'result' },
      to: { node_id: `abs${i + 1}`, port_name: 'number' },
    })),
    { from: { node_id: 'abs5', port_name: 'result' }, to: { node_id: 'out', port_name: 'value' } },
  ];
  return { nodes, links };
}

async function testBusyFlowOutlivesIdleWindow() {
  console.log('\n--- busy flow: total >> idle window, still completes ---');
  const engine = await Workbench.create(chainFlow(), { keys: {}, idleTimeoutMs: 400 });
  // Each step sleeps 150ms — under the 400ms idle window — but the
  // five of them total ~750ms, well past it. Progress stamps at every
  // node boundary must keep the watchdog fed.
  engine.nodes['absolute'].process = async ({ inputs }) => {
    await sleep(150);
    return { result: Math.abs(inputs.number) };
  };
  const res = await engine.run({ x: -7 }, 10000);
  assert.strictEqual(res.outputs.out, 7, 'chain should produce |x|');
  assert.strictEqual(engine.abortController.signal.aborted, false, 'no abort on a busy flow');
  console.log('  ✓ ~750ms of steady 150ms steps survived a 400ms idle window');
}

async function testHungNodeDiesAtIdleNotWall() {
  console.log('\n--- hung node: dies at ~idle, long before the wall cap ---');
  const engine = await Workbench.create(chainFlow(), { keys: {}, idleTimeoutMs: 400 });
  engine.nodes['absolute'].process = () => new Promise(() => {});
  const t0 = Date.now();
  let message = '';
  try {
    await engine.run({ x: -7 }, 30000);
    assert.fail('run should reject when a node hangs past the idle window');
  } catch (e) {
    message = e.message;
  }
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 3000, `should abort near the 400ms idle window, took ${elapsed}ms`);
  assert.ok(/without progress/.test(message), `error should name the idle timeout, got: "${message}"`);
  assert.strictEqual(engine.abortController.signal.aborted, true, 'abort signal should have fired');
  console.log(`  ✓ aborted in ${elapsed}ms (wall cap was 30s), error: "${message}"`);
}

async function testNoIdleConfigUnchanged() {
  console.log('\n--- no idleTimeoutMs: wall-cap behavior unchanged ---');
  const engine = await Workbench.create(chainFlow(), { keys: {} });
  engine.nodes['absolute'].process = () => new Promise(() => {});
  const t0 = Date.now();
  let message = '';
  try {
    await engine.run({ x: -7 }, 600);
    assert.fail('run should reject at the wall cap');
  } catch (e) {
    message = e.message;
  }
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 500, `should wait for the 600ms wall cap, took ${elapsed}ms`);
  assert.ok(!/without progress/.test(message), 'error should be the wall-cap message, not idle');
  console.log(`  ✓ waited for the wall cap (${elapsed}ms), error: "${message}"`);
}

async function main() {
  console.log('Testing idle watchdog...');
  try {
    await testBusyFlowOutlivesIdleWindow();
    await testHungNodeDiesAtIdleNotWall();
    await testNoIdleConfigUnchanged();
    console.log('\n✅ All idle-timeout tests passed.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

main();
