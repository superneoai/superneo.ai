import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { createViewport } from "./browser.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const RESULTS_FILE = resolve(ROOT, "tests/fixtures/visual-results.json");
const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 390, height: 844 },
};
const ACTS = ["car", "ninja", "island", "cosmos"];
const cli = new Map(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.replace(/^--/, "").split("=");
  return [key, value.length ? value.join("=") : true];
}));
const requestedBrowsers = String(
  cli.get("browsers") || process.env.SUPERNEO_VISUAL_BROWSERS || "chromium,zen,safari",
).split(",").filter(Boolean);
const outputRoot = resolve("/private/tmp/superneo-showcase-visuals");

const sleep = (duration) => new Promise((resolveSleep) => setTimeout(resolveSleep, duration));
const rounded = (value) => Math.round(value * 1000) / 1000;

async function startServer() {
  const explicit = cli.get("base-url") || process.env.SUPERNEO_VISUAL_BASE_URL;
  if (explicit) return { baseUrl: String(explicit).replace(/\/$/, ""), child: null };
  const port = Number(cli.get("port") || 4175);
  const child = spawn(
    resolve(ROOT, "node_modules/.bin/vite"),
    ["--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: ROOT, stdio: "ignore" },
  );
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return { baseUrl, child };
    } catch {
      // Vite has not accepted connections yet.
    }
    await sleep(100);
  }
  child.kill("SIGTERM");
  throw new Error("visual test server did not start");
}

async function waitForReady(session) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (await session.execute(`return document.querySelector('.experience')?.dataset.sceneReady === 'true';`)) {
      return;
    }
    await sleep(50);
  }
  throw new Error("showcase scene did not become ready");
}

async function waitForVisualSettle(session) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const settled = await session.execute(`
      const stage = document.querySelector('.signal-stage');
      return stage && Number.parseFloat(getComputedStyle(stage).opacity) >= 0.99;
    `);
    if (settled) {
      await sleep(900);
      return;
    }
    await sleep(25);
  }
  throw new Error("showcase entrance did not settle");
}

function frameMetrics(buffer) {
  const image = PNG.sync.read(buffer);
  let sum = 0;
  let sumSquared = 0;
  let illuminated = 0;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const luminance = image.data[offset] * 0.2126 +
      image.data[offset + 1] * 0.7152 + image.data[offset + 2] * 0.0722;
    sum += luminance;
    sumSquared += luminance * luminance;
    if (luminance > 42) illuminated += 1;
  }
  const pixels = image.width * image.height;
  const mean = sum / pixels;
  return {
    mean: rounded(mean),
    deviation: rounded(Math.sqrt(Math.max(0, sumSquared / pixels - mean * mean))),
    illuminated,
  };
}

async function capture(session, directory, name) {
  await session.execute(`scrollTo(0, 0); return scrollY;`);
  await session.execute(`
    document.getAnimations().forEach((animation) => {
      const endTime = animation.effect?.getComputedTiming().endTime;
      if (typeof endTime === 'number' && Number.isFinite(endTime)) {
        try { animation.finish(); } catch { /* non-seekable CSS animation */ }
      }
    });
  `);
  await sleep(80);
  const buffer = await session.screenshot();
  const metrics = frameMetrics(buffer);
  await writeFile(resolve(directory, `${name}.png`), buffer);
  assert.ok(metrics.deviation > 8, `${name} has no readable dimensional contrast`);
  assert.ok(metrics.illuminated > 500, `${name} has no readable subject`);
  return metrics;
}

async function measureRapidScroll(session, baseUrl) {
  await session.goto(baseUrl);
  await waitForReady(session);
  await waitForVisualSettle(session);
  const gaps = await session.execute(`
    return new Promise((resolve) => {
      const range = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      const samples = [];
      let pass = 0;
      let started = 0;
      let previous = 0;
      scrollTo(0, range * 0.62);
      const tick = (now) => {
        if (started === 0) {
          started = now;
          previous = now;
        } else {
          samples.push(now - previous);
        }
        previous = now;
        const progress = Math.min(1, (now - started) / 350);
        scrollTo(0, range * (0.62 + progress * 0.38));
        if (progress < 1) return requestAnimationFrame(tick);
        pass += 1;
        if (pass < 3) {
          scrollTo(0, range * 0.62);
          started = 0;
          previous = 0;
          return requestAnimationFrame(tick);
        }
        resolve(samples);
      };
      requestAnimationFrame(tick);
    });
  `);
  const sorted = [...gaps].sort((left, right) => left - right);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const maximum = Math.max(0, ...gaps);
  assert.ok(maximum <= 50, `rapid scroll produced a ${rounded(maximum)}ms stopped frame`);
  return { frames: gaps.length, p95Gap: rounded(p95), maxGap: rounded(maximum) };
}

async function runViewport(browserName, viewportName, viewport, baseUrl) {
  const session = await createViewport(browserName, viewport);
  const directory = resolve(outputRoot, browserName, viewportName);
  await mkdir(directory, { recursive: true });
  const captures = {};
  try {
    for (const act of ACTS) {
      const progress = act === "cosmos" ? 1 : 0;
      await session.goto(`${baseUrl}/?qaAct=${act}&qaTransition=${progress}&freezeScene=1`);
      await waitForReady(session);
      await waitForVisualSettle(session);
      captures[`act-${act}`] = await capture(session, directory, `act-${act}`);
    }
    for (const act of ACTS.slice(0, 3)) {
      for (const transition of [0.25, 0.5, 0.75]) {
        await session.goto(
          `${baseUrl}/?qaAct=${act}&qaTransition=${transition}&freezeScene=1`,
        );
        await waitForReady(session);
        await waitForVisualSettle(session);
        const name = `morph-${act}-${Math.round(transition * 100)}`;
        captures[name] = await capture(session, directory, name);
      }
    }
    await session.goto(`${baseUrl}/?qaAct=cosmos&qaTransition=.5&reducedMotion=1`);
    await waitForReady(session);
    await waitForVisualSettle(session);
    captures.reducedMotion = await capture(session, directory, "reduced-motion");
    return {
      viewport,
      captures,
      performance: cli.get("skip-performance")
        ? {
            status: "not-run",
            reason: "visual-only browser compatibility run",
          }
        : await measureRapidScroll(session, baseUrl),
    };
  } finally {
    await session.close();
  }
}

const server = await startServer();
let previousResults = {};
if (cli.get("merge")) {
  try {
    previousResults = JSON.parse(await readFile(RESULTS_FILE, "utf8"));
  } catch {
    previousResults = {};
  }
}
const results = {
  designAuthorityCommit: "3988496",
  testedCommit: "working-tree",
  browsers: { ...(previousResults.browsers || {}) },
};

try {
  for (const browserName of requestedBrowsers) {
    results.browsers[browserName] = {};
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      results.browsers[browserName][viewportName] = await runViewport(
        browserName,
        viewportName,
        viewport,
        server.baseUrl,
      );
    }
  }
  await writeFile(RESULTS_FILE, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Visual results written to ${RESULTS_FILE}`);
} finally {
  server.child?.kill("SIGTERM");
}
