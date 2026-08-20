import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = 4194;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const sleep = (duration) => new Promise((resolveSleep) => setTimeout(resolveSleep, duration));

async function startServer() {
  const child = spawn(
    resolve(ROOT, "node_modules/.bin/vite"),
    ["--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const startedAt = Date.now();
  while (Date.now() - startedAt < 12_000) {
    if (child.exitCode !== null) throw new Error(`Vite stopped early:\n${output}`);
    try {
      if ((await fetch(BASE_URL)).ok) return child;
    } catch {}
    await sleep(100);
  }
  child.kill("SIGTERM");
  throw new Error(`Vite failed to start:\n${output}`);
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  const exited = new Promise((resolveExit) => server.once("exit", resolveExit));
  server.kill("SIGTERM");
  await Promise.race([exited, sleep(2_000)]);
}

async function sampleStageWord(page, fraction) {
  await page.evaluate((stageFraction) => {
    const range = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    window.scrollTo(0, range * (2 + stageFraction) / 3);
  }, fraction);
  await page.waitForFunction(
    () => document.querySelector('h2[data-order="2"]')?.getAttribute("data-state") === "active",
  );
  await page.evaluate(() => new Promise((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
  }));
  return page.evaluate(() => {
    const word = document.querySelector('h2[data-order="2"] .stage-word');
    assertWord(word);
    const style = getComputedStyle(word);
    const matrix = new DOMMatrixReadOnly(style.transform);
    const range = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    return {
      scroll: window.scrollY,
      progress: window.scrollY / range,
      x: matrix.m41,
      y: matrix.m42,
      opacity: Number(style.opacity),
    };

    function assertWord(element) {
      if (!(element instanceof HTMLElement)) throw new Error("final stage word is missing");
    }
  });
}

async function sampleActiveWordPosition(page, scroll, stage) {
  await page.evaluate((nextScroll) => window.scrollTo(0, nextScroll), scroll);
  await page.waitForFunction(
    (nextStage) => document.querySelector(`h2[data-order="${nextStage}"]`)?.getAttribute("data-state") === "active",
    stage,
  );
  await page.evaluate(() => new Promise((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
  }));
  return page.evaluate(() => {
    const word = document.querySelector('h2[data-state="active"] .stage-word');
    if (!(word instanceof HTMLElement)) throw new Error("active stage word is missing");
    const bounds = word.getBoundingClientRect();
    return { scroll: window.scrollY, x: bounds.x, y: bounds.y };
  });
}

function distanceBetween(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

async function sampleBoundaryVelocity(page, boundary, radius = 8) {
  const positions = [];
  for (let scroll = boundary - radius; scroll <= boundary + radius; scroll += 1) {
    positions.push(await sampleActiveWordPosition(
      page,
      scroll,
      scroll < boundary ? 1 : 2,
    ));
  }
  return positions.slice(1).map((position, index) => ({
    from: positions[index].scroll,
    to: position.scroll,
    delta: distanceBetween(positions[index], position),
  }));
}

test("the active stage word travels continuously with scroll distance", { timeout: 90_000 }, async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/?neoState=full`, { waitUntil: "load" });
    await page.locator(".signal-canvas").waitFor({ state: "attached" });
    await page.waitForFunction(
      () => document.querySelector(".experience")?.getAttribute("data-scene-ready") === "true",
    );
    await sleep(1_100);
    await page.evaluate(() => document.fonts.ready);
    const fractions = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 1];
    const samples = [];
    for (const fraction of fractions) samples.push(await sampleStageWord(page, fraction));

    assert.ok(Math.hypot(samples[0].x, samples[0].y) > 45);
    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1];
      const current = samples[index];
      assert.ok(current.x >= previous.x - 0.02, `x reversed at sample ${index}`);
      assert.ok(current.y >= previous.y - 0.02, `y reversed at sample ${index}`);
      assert.ok(
        Math.hypot(current.x, current.y) <= Math.hypot(previous.x, previous.y) + 0.02,
        `distance reversed at sample ${index}`,
      );
      assert.ok(current.opacity >= previous.opacity - 0.001, `opacity reversed at sample ${index}`);
    }

    const landing = samples.at(-1);
    assert.ok(Math.abs(landing.x) < 0.1, `final x offset is ${landing.x}px`);
    assert.ok(Math.abs(landing.y) < 0.1, `final y offset is ${landing.y}px`);

    const range = await page.evaluate(
      () => Math.max(document.documentElement.scrollHeight - window.innerHeight, 1),
    );
    const boundary = Math.ceil(range * 2 / 3);
    const beforeStep = await sampleActiveWordPosition(page, boundary - 2, 1);
    const immediatelyBefore = await sampleActiveWordPosition(page, boundary - 1, 1);
    const immediatelyAfter = await sampleActiveWordPosition(page, boundary, 2);
    const afterStep = await sampleActiveWordPosition(page, boundary + 1, 2);
    const adjacentStep = Math.max(
      distanceBetween(beforeStep, immediatelyBefore),
      distanceBetween(immediatelyAfter, afterStep),
    );
    const handoffDelta = distanceBetween(immediatelyBefore, immediatelyAfter);
    assert.ok(
      handoffDelta <= adjacentStep * 1.5,
      `stage handoff moved ${handoffDelta}px while an adjacent scroll step moved ${adjacentStep}px`,
    );

    const velocityProfile = await sampleBoundaryVelocity(page, boundary);
    const seamVelocity = velocityProfile.find(({ from, to }) => (
      from === boundary - 1 && to === boundary
    ))?.delta ?? Number.NaN;
    const adjacentVelocity = velocityProfile.filter(({ from, to }) => (
      (from >= boundary - 4 && to < boundary)
      || (from >= boundary && to <= boundary + 3)
    ));
    const meanAdjacentVelocity = adjacentVelocity.reduce(
      (total, { delta }) => total + delta,
      0,
    ) / adjacentVelocity.length;
    assert.ok(
      Math.abs(seamVelocity - meanAdjacentVelocity) <= meanAdjacentVelocity * 0.12,
      `stage seam velocity ${seamVelocity}px diverged from adjacent velocity ${meanAdjacentVelocity}px`,
    );

    const heldBefore = await sampleStageWord(page, 0.55);
    await sleep(700);
    const heldAfter = await page.evaluate(() => {
      const word = document.querySelector('h2[data-order="2"] .stage-word');
      if (!(word instanceof HTMLElement)) throw new Error("final stage word is missing");
      const matrix = new DOMMatrixReadOnly(getComputedStyle(word).transform);
      return { x: matrix.m41, y: matrix.m42 };
    });
    assert.ok(Math.abs(heldAfter.x - heldBefore.x) < 0.01);
    assert.ok(Math.abs(heldAfter.y - heldBefore.y) < 0.01);

    process.stdout.write(`stage word samples ${JSON.stringify(samples)}\n`);
    process.stdout.write(`stage handoff samples ${JSON.stringify({
      beforeStep,
      immediatelyBefore,
      immediatelyAfter,
      afterStep,
      adjacentStep,
      handoffDelta,
    })}\n`);
    process.stdout.write(`stage seam velocity ${JSON.stringify({
      meanAdjacentVelocity,
      seamVelocity,
      profile: velocityProfile,
    })}\n`);
  } finally {
    await context.close();
    await browser.close();
    await stopServer(server);
  }
});
