import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = 4194;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const sleep = (duration) => new Promise((resolveSleep) => setTimeout(resolveSleep, duration));

async function startPreview() {
  const child = spawn(
    resolve(ROOT, "node_modules/.bin/vite"),
    ["preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const startedAt = Date.now();
  while (Date.now() - startedAt < 12_000) {
    if (child.exitCode !== null) throw new Error(`Preview stopped early:\n${output}`);
    try {
      if ((await fetch(BASE_URL)).ok) return child;
    } catch {
      // Wait for the production preview.
    }
    await sleep(100);
  }
  child.kill("SIGTERM");
  throw new Error(`Preview failed to start:\n${output}`);
}

async function stopPreview(server) {
  if (server.exitCode !== null) return;
  const exited = new Promise((resolveExit) => server.once("exit", resolveExit));
  server.kill("SIGTERM");
  await Promise.race([exited, sleep(2_000)]);
}

test("production falls back to the live poster when WebGL cannot start", { timeout: 60_000 }, async () => {
  const server = await startPreview();
  const browser = await chromium.launch({ headless: true, args: ["--disable-webgl"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (
      document.querySelector(".experience")?.getAttribute("data-scene-ready") === "true"
      && document.querySelector(".signal-stage")?.getAttribute("data-renderer") === "poster"
    ), undefined, { timeout: 12_000 });

    const initial = await page.evaluate(() => ({
      headerVisibility: getComputedStyle(document.querySelector(".site-header")).visibility,
      posterVisibility: getComputedStyle(document.querySelector(".signal-poster")).visibility,
      loaderDisplay: getComputedStyle(document.querySelector(".scene-loader")).display,
    }));
    assert.deepEqual(initial, {
      headerVisibility: "visible",
      posterVisibility: "visible",
      loaderDisplay: "none",
    });

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => (
      document.querySelector('.stage-stack h2[data-state="active"]')?.textContent?.includes("SUPER")
    ));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await stopPreview(server);
  }
});
