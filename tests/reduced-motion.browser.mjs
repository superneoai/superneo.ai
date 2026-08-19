import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = 4193;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const READY_WAIT_MS = 30_000;
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
    } catch {
      // Wait for the development server.
    }
    await sleep(100);
  }
  child.kill("SIGTERM");
  throw new Error(`Vite failed to start:\n${output}`);
}

test("the scene still reaches its ready state when motion is reduced", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    // Reduced motion renders on demand rather than every frame. Readiness needs
    // more than one valid frame, so a scene that stops asking for frames leaves
    // these visitors on the poster fallback forever. Only the reduced case is
    // exercised here; every other browser test already covers the default.
    for (const reducedMotion of ["reduce"]) {
      for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport, reducedMotion });
        const page = await context.newPage();
        await page.goto(`${BASE_URL}/?neoState=full`, { waitUntil: "load" });
        await page.waitForFunction(
          () => document.querySelector(".experience")?.dataset.sceneReady === "true",
          null,
          { timeout: READY_WAIT_MS },
        ).catch(() => {
          throw new Error(
            `the scene never became ready with reducedMotion=${reducedMotion} `
            + `at ${viewport.width}x${viewport.height}`,
          );
        });
        // Readiness is the contract worth pinning. How quickly the poster then
        // fades depends on the renderer, and software rasterisers on CI are far
        // slower than a GPU, so that timing is deliberately not asserted here.
        const sceneReady = await page.evaluate(
          () => document.querySelector(".experience")?.dataset.sceneReady,
        );
        assert.equal(
          sceneReady,
          "true",
          `the scene left reducedMotion=${reducedMotion} unready`,
        );
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }
});
