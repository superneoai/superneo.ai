import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = 4192;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
  + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const sleep = (duration) => new Promise((resolveSleep) => setTimeout(resolveSleep, duration));

async function startServer() {
  const child = spawn(
    resolve(ROOT, "node_modules/.bin/vite"),
    ["--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        VITE_POSTHOG_KEY: "phc_browser_test",
        VITE_POSTHOG_HOST: "https://us.i.posthog.com",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
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

async function stopServer(server) {
  if (server.exitCode !== null) return;
  const exited = new Promise((resolveExit) => server.once("exit", resolveExit));
  server.kill("SIGTERM");
  await Promise.race([exited, sleep(2_000)]);
}

test("consent blocks, permits, and withdraws PostHog without affecting the experience", { timeout: 60_000 }, async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: TEST_USER_AGENT,
  });
  const page = await context.newPage();
  const posthogRequests = [];
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.route("https://us.i.posthog.com/**", async (route) => {
    posthogRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  try {
    await page.goto(`${BASE_URL}/?analyticsQa=1`, { waitUntil: "domcontentloaded" });
    const dock = page.locator(".analytics-consent-dock");
    await dock.waitFor({ state: "visible", timeout: 15_000 });
    assert.equal(posthogRequests.length, 0, "PostHog must remain silent before consent");

    const actions = dock.locator(".analytics-consent-actions button");
    const allowBox = await actions.nth(0).boundingBox();
    const declineBox = await actions.nth(1).boundingBox();
    const dockBox = await dock.boundingBox();
    const footerBox = await page.locator(".site-footer").boundingBox();
    assert.ok(allowBox && declineBox);
    assert.ok(dockBox && footerBox);
    assert.equal(Math.round(allowBox.width), Math.round(declineBox.width));
    assert.equal(Math.round(allowBox.height), Math.round(declineBox.height));
    assert.ok(allowBox.height >= 44 && declineBox.height >= 44);
    assert.ok(Math.abs(allowBox.y - declineBox.y) < 1, "mobile choices stay side by side");
    assert.ok(footerBox.y + footerBox.height <= dockBox.y, "the consent dock must not cover the footer");

    await actions.nth(1).click();
    await dock.waitFor({ state: "detached" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(900);
    assert.equal(posthogRequests.length, 0, "decline must persist without PostHog traffic");

    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await dock.waitFor({ state: "visible", timeout: 15_000 });
    await dock.locator(".analytics-consent-actions button").nth(0).click();
    const requestStartedAt = Date.now();
    while (posthogRequests.length === 0 && Date.now() - requestStartedAt < 8_000) {
      await sleep(100);
    }
    assert.ok(posthogRequests.length > 0, "acceptance should enable the US ingestion endpoint");
    assert.ok(posthogRequests.every((url) => url.startsWith("https://us.i.posthog.com/")));

    const privacyButton = page.locator(".privacy-link");
    await privacyButton.click();
    const preferences = page.locator(".privacy-preferences[open]");
    await preferences.waitFor({ state: "visible" });
    const toggle = preferences.locator(".privacy-toggle input");
    assert.equal(await toggle.isChecked(), true);
    await preferences.locator(".privacy-toggle").click();
    assert.equal(await toggle.isChecked(), false);
    await preferences.locator("footer button").click();
    await preferences.waitFor({ state: "hidden" });

    const countAfterWithdrawal = posthogRequests.length;
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("superneo:analytics", {
        detail: { name: "audio_toggled", properties: { state: "playing" } },
      }));
    });
    await sleep(700);
    assert.equal(posthogRequests.length, countAfterWithdrawal);
    const storageKeys = await page.evaluate(() => Object.keys(window.localStorage));
    assert.equal(storageKeys.some((key) => /^(?:ph_|__ph)/.test(key)), false);
    assert.deepEqual(browserErrors, []);
  } finally {
    await context.close();
    await browser.close();
    await stopServer(server);
  }
});

test("Global Privacy Control is an automatic decline", { timeout: 30_000 }, async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: TEST_USER_AGENT,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "globalPrivacyControl", { value: true });
  });
  const page = await context.newPage();
  const requests = [];
  await page.route("https://us.i.posthog.com/**", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  try {
    await page.goto(`${BASE_URL}/?analyticsQa=1`, { waitUntil: "domcontentloaded" });
    await sleep(3_200);
    assert.equal(await page.locator(".analytics-consent-dock").count(), 0);
    assert.equal(requests.length, 0);
    const consentCookie = (await context.cookies()).find((cookie) => cookie.name === "sn_consent");
    assert.ok(consentCookie, "GPC decline should be remembered");
  } finally {
    await context.close();
    await browser.close();
    await stopServer(server);
  }
});
