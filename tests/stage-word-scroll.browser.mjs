import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import {
  monitorSceneFailures,
  waitForSceneOrVerifiedFallback,
} from "./browser-scene.mjs";

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

async function sampleContainment(page, progress) {
  await page.evaluate((nextProgress) => {
    const range = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    window.scrollTo(0, range * nextProgress);
  }, progress);
  await page.evaluate(() => new Promise((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
  }));
  return page.evaluate((sampleProgress) => {
    const word = document.querySelector('h2[data-state="active"] .stage-word');
    const panel = document.querySelector(".stage-panel");
    const header = document.querySelector(".site-header");
    const footer = document.querySelector(".site-footer");
    if (!(word instanceof HTMLElement)) throw new Error("active stage word is missing");
    if (!(panel instanceof HTMLElement)) throw new Error("stage panel is missing");
    if (!(header instanceof HTMLElement)) throw new Error("site header is missing");
    if (!(footer instanceof HTMLElement)) throw new Error("site footer is missing");
    const toRect = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        left: bounds.left,
      };
    };
    const overlaps = (left, right) => (
      left.left < right.right
      && left.right > right.left
      && left.top < right.bottom
      && left.bottom > right.top
    );
    const wordRect = toRect(word);
    const panelRect = toRect(panel);
    const clippingAncestors = [];
    for (let ancestor = word.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const clipsX = style.overflowX !== "visible";
      const clipsY = style.overflowY !== "visible";
      if (!clipsX && !clipsY) continue;
      const bounds = toRect(ancestor);
      clippingAncestors.push({
        className: ancestor.className,
        clipsX,
        clipsY,
        left: wordRect.left - bounds.left,
        top: wordRect.top - bounds.top,
        right: bounds.right - wordRect.right,
        bottom: bounds.bottom - wordRect.bottom,
      });
    }
    const layoutBox = (element) => ({
      left: element.offsetLeft,
      top: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
    });
    return {
      progress: sampleProgress,
      stage: Number(word.closest("h2")?.dataset.order),
      margins: {
        left: wordRect.left - panelRect.left,
        top: wordRect.top - panelRect.top,
        right: panelRect.right - wordRect.right,
        bottom: panelRect.bottom - wordRect.bottom,
      },
      overlapsHeader: overlaps(wordRect, toRect(header)),
      overlapsFooter: overlaps(wordRect, toRect(footer)),
      clippingAncestors,
      layout: {
        panel: {
          left: panelRect.left,
          top: panelRect.top,
          width: panelRect.right - panelRect.left,
          height: panelRect.bottom - panelRect.top,
        },
        words: Array.from(document.querySelectorAll(".stage-word"), layoutBox),
      },
    };
  }, progress);
}

async function measureContainment(page, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(450);
  await page.evaluate(() => new Promise((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
  }));
  const samples = [];
  for (let step = 0; step <= 12; step += 1) {
    samples.push(await sampleContainment(page, step / 12));
  }
  const initialLayout = samples[0].layout;
  for (const sample of samples) {
    for (const [edge, margin] of Object.entries(sample.margins)) {
      assert.ok(
        margin >= -0.1,
        `${viewport.width}px word escaped the panel ${edge} edge by ${-margin}px at ${sample.progress}`,
      );
    }
    assert.equal(sample.overlapsHeader, false, `${viewport.width}px word overlapped the header`);
    assert.equal(sample.overlapsFooter, false, `${viewport.width}px word overlapped the footer`);
    for (const ancestor of sample.clippingAncestors) {
      if (ancestor.clipsX) {
        assert.ok(ancestor.left >= -0.1 && ancestor.right >= -0.1,
          `${viewport.width}px word escaped a horizontal clipping ancestor`);
      }
      if (ancestor.clipsY) {
        assert.ok(ancestor.top >= -0.1 && ancestor.bottom >= -0.1,
          `${viewport.width}px word escaped a vertical clipping ancestor`);
      }
    }
    assert.deepEqual(sample.layout, initialLayout, `${viewport.width}px layout changed while scrolling`);
  }
  return {
    width: viewport.width,
    minLeft: Math.min(...samples.map(({ margins }) => margins.left)),
    minTop: Math.min(...samples.map(({ margins }) => margins.top)),
    minRight: Math.min(...samples.map(({ margins }) => margins.right)),
    minBottom: Math.min(...samples.map(({ margins }) => margins.bottom)),
  };
}

test("the active stage word travels continuously with scroll distance", { timeout: 180_000 }, async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const failures = monitorSceneFailures(page);

  try {
    await page.goto(`${BASE_URL}/?neoState=full`, { waitUntil: "load" });
    await waitForSceneOrVerifiedFallback(page, failures);
    await page.evaluate(() => new Promise((resolveFrame) => {
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
    }));
    await page.locator(".stage-panel").evaluate((panel) => (
      Promise.all(panel.getAnimations().map((animation) => animation.finished))
    ));
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

    await page.setViewportSize({ width: 1280, height: 720 });
    await sampleContainment(page, 0);
    const clsSupported = await page.evaluate(() => (
      PerformanceObserver.supportedEntryTypes.includes("layout-shift")
    ));
    await page.evaluate(() => {
      window.__stageWordCls = 0;
      window.__stageWordClsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__stageWordCls += entry.value;
        }
      });
      window.__stageWordClsObserver.observe({ type: "layout-shift" });
    });
    for (let step = 1; step <= 24; step += 1) {
      await sampleContainment(page, step / 24);
    }
    const cumulativeLayoutShift = await page.evaluate(() => {
      window.__stageWordClsObserver.disconnect();
      return window.__stageWordCls;
    });
    assert.equal(clsSupported, true, "Chromium does not expose layout-shift entries");
    assert.ok(
      cumulativeLayoutShift <= 0.001,
      `full stage scroll produced ${cumulativeLayoutShift} cumulative layout shift`,
    );

    const containment = [];
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1013, height: 720 },
      { width: 820, height: 720 },
      { width: 720, height: 844 },
      { width: 480, height: 844 },
      { width: 390, height: 844 },
    ]) {
      containment.push(await measureContainment(page, viewport));
    }

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
    process.stdout.write(`stage containment ${JSON.stringify(containment)}\n`);
    process.stdout.write(`stage cumulative layout shift ${cumulativeLayoutShift}\n`);
  } finally {
    await context.close();
    await browser.close();
    await stopServer(server);
  }
});
