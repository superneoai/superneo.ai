import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = 4192;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CONSENT_WAIT_MS = 30_000;
const TEST_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
  + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const sleep = (duration) => new Promise((resolveSleep) => setTimeout(resolveSleep, duration));

function launchConsentBrowser() {
  return chromium.launch({ headless: true });
}

function decodePostHogPayload(request) {
  const body = request.postDataBuffer();
  if (!body) return null;
  try {
    return JSON.parse(gunzipSync(body).toString("utf8"));
  } catch {
    return JSON.parse(body.toString("utf8"));
  }
}

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

test("consent blocks, permits, and withdraws PostHog without affecting the experience", { timeout: 90_000 }, async () => {
  const server = await startServer();
  const privacyPage = await fetch(`${BASE_URL}/privacy/`).then((response) => response.text());
  const legalPage = await fetch(`${BASE_URL}/legal/index.html`).then((response) => response.text());
  assert.match(privacyPage, /<title>Privacy — superneo\.ai<\/title>/);
  assert.match(privacyPage, /<h1>Privacy<\/h1>/);
  assert.match(privacyPage, /aria-label="Back to superneo\.ai">[\s\S]*?<svg[\s\S]*?<span>BACK<\/span>/);
  assert.doesNotMatch(privacyPage, /RETURN TO SUPERNEO/);
  assert.match(legalPage, /<title>Legal — superneo\.ai<\/title>/);
  assert.match(legalPage, /<h1>Legal<\/h1>/);
  const browser = await launchConsentBrowser();
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
    posthogRequests.push({
      url: route.request().url(),
      payload: decodePostHogPayload(route.request()),
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  try {
    await page.goto(`${BASE_URL}/?analyticsQa=1&consentPreview=0&sceneFault=renderer`, {
      waitUntil: "domcontentloaded",
    });
    const dock = page.locator(".analytics-consent-dock");
    await dock.waitFor({ state: "visible", timeout: CONSENT_WAIT_MS });
    await page.waitForFunction(() => {
      const dockElement = document.querySelector(".analytics-consent-dock");
      const footerElement = document.querySelector(".site-footer");
      if (!(dockElement instanceof HTMLElement) || !(footerElement instanceof HTMLElement)) return false;
      const dockBounds = dockElement.getBoundingClientRect();
      const footerBounds = footerElement.getBoundingClientRect();
      return footerBounds.bottom <= dockBounds.top;
    });
    assert.equal(await page.locator("#cc-main").isVisible(), false,
      "CookieConsent must not expose a second consent dialog");
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
    await page.waitForFunction(() => (
      document.querySelector(".analytics-consent-dock")?.getAttribute("data-state") === "closing"
    ), undefined, { timeout: 2_000 });
    await dock.waitFor({ state: "detached" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(900);
    assert.equal(posthogRequests.length, 0, "decline must persist without PostHog traffic");

    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await dock.waitFor({ state: "visible", timeout: CONSENT_WAIT_MS });
    await dock.locator(".analytics-consent-actions button").nth(0).click();
    await dock.waitFor({ state: "detached" });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("superneo:analytics", {
        detail: { name: "audio_toggled", properties: { state: "playing" } },
      }));
    });
    const requestStartedAt = Date.now();
    while (posthogRequests.length === 0 && Date.now() - requestStartedAt < 8_000) {
      await sleep(100);
    }
    assert.ok(posthogRequests.length > 0, "acceptance should enable the US ingestion endpoint");
    assert.ok(posthogRequests.every(({ url }) => url.startsWith("https://us.i.posthog.com/")));
    const capturedEvents = posthogRequests.flatMap(({ payload }) => payload?.batch ?? []);
    const audioEvent = capturedEvents.find(({ event }) => event === "audio_toggled");
    assert.ok(audioEvent, "the explicitly dispatched event should be captured");
    assert.equal(audioEvent.properties.surface, "landing");
    assert.equal(audioEvent.properties.environment, "development");
    [
      "$current_url",
      "$initial_current_url",
      "$session_entry_url",
      "$session_entry_pathname",
      "$session_entry_referrer",
      "$raw_user_agent",
    ].forEach((property) => {
      assert.equal(property in audioEvent.properties, false, `${property} must be scrubbed`);
    });

    await page.locator("main.experience").evaluate((experience) => {
      experience.setAttribute("data-scene-ready", "true");
    });
    await sleep(700);
    const mobileFooter = await page.evaluate(() => {
      const bounds = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
        };
      };
      const contactItems = Array.from(document.querySelectorAll(".contact-links .contact-link"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
          };
        });
      const siteItems = Array.from(document.querySelectorAll(".footer-privacy .contact-link"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label: element.textContent?.trim(),
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
          };
        });
      return {
        footer: bounds(".site-footer"),
        status: bounds(".status-line"),
        privacy: bounds(".footer-privacy"),
        contacts: bounds(".contact-links"),
        contactItems,
        contactDirection: getComputedStyle(document.querySelector(".contact-links")).flexDirection,
        siteItems,
        siteLabel: document.querySelector(".footer-privacy")?.getAttribute("aria-label"),
      };
    });
    assert.ok(mobileFooter.footer && mobileFooter.status && mobileFooter.privacy && mobileFooter.contacts);
    assert.equal(mobileFooter.siteLabel, "Site information");
    assert.deepEqual(mobileFooter.siteItems.map(({ label }) => label), ["PRIVACY", "LEGAL"]);
    assert.ok(
      mobileFooter.siteItems.every(({ bottom, left, right, top }) => (
        right - left >= 44 && bottom - top >= 44
      )),
      "mobile site-information links retain 44 by 44px touch targets",
    );
    assert.ok(
      mobileFooter.siteItems.every(({ top }) => Math.abs(top - mobileFooter.siteItems[0].top) < 1),
      "PRIVACY and LEGAL share one mobile baseline",
    );
    assert.ok(
      Math.abs(
        (mobileFooter.privacy.left + mobileFooter.privacy.right) / 2
        - (mobileFooter.footer.left + mobileFooter.footer.right) / 2
      ) < 1,
      "site-information links remain centered in the footer",
    );
    assert.equal(mobileFooter.contactDirection, "column", "narrow contact links use both footer rows");
    assert.ok(
      mobileFooter.contactItems.every(({ bottom, left, right, top }) => (
        Math.round(right - left) >= 44 && Math.round(bottom - top) >= 44
      )),
      "mobile contact links retain 44 by 44px touch targets",
    );
    assert.ok(
      mobileFooter.contactItems.every(({ right }) => Math.abs(right - mobileFooter.footer.right) < 1),
      "mobile contact links stay flush right",
    );
    assert.ok(
      Math.abs(mobileFooter.contactItems[0].top - mobileFooter.footer.top) < 1
      && Math.abs(mobileFooter.contactItems.at(-1).bottom - mobileFooter.footer.bottom) < 1,
      "mobile contact links occupy both footer rows",
    );
    assert.ok(
      mobileFooter.contactItems[0].bottom <= mobileFooter.contactItems[1].top + 1,
      "mobile contact targets do not overlap",
    );
    assert.ok(
      Math.abs(
        (mobileFooter.status.top + mobileFooter.status.bottom) / 2
        - (mobileFooter.contactItems[1].top + mobileFooter.contactItems[1].bottom) / 2
      ) < 1,
      "mobile status shares the lower contact baseline",
    );
    assert.ok(
      mobileFooter.privacy.right <= mobileFooter.contactItems[0].left + 1,
      "mobile site-information and contact links do not overlap",
    );
    assert.ok(
      mobileFooter.status.right <= mobileFooter.contactItems[1].left + 1,
      "mobile status and contact links do not overlap",
    );
    assert.ok(
      mobileFooter.privacy.bottom <= mobileFooter.status.top + 1,
      "mobile privacy sits above the status row",
    );
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
    await page.waitForFunction(() => document.activeElement?.classList.contains("privacy-link"));

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

    const legalLink = page.getByRole("link", { name: "LEGAL", exact: true });
    assert.equal(await legalLink.getAttribute("href"), "./legal/");
    assert.equal(await legalLink.getAttribute("aria-haspopup"), null);
    await legalLink.focus();
    assert.equal(await legalLink.evaluate((link) => document.activeElement === link), true);
    await Promise.all([
      page.waitForURL(`${BASE_URL}/legal/`),
      legalLink.click(),
    ]);
    assert.equal(await page.locator(".privacy-preferences[open]").count(), 0);
    assert.deepEqual(browserErrors, []);
  } finally {
    await context.close();
    await browser.close();
    await stopServer(server);
  }
});

test("the discovery reward returns to the persistent footer notice", { timeout: 90_000 }, async () => {
  const server = await startServer();
  const browser = await launchConsentBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: TEST_USER_AGENT,
  });
  const page = await context.newPage();
  const activeFooterCopy = () => page.locator(".discovery-copy").evaluate((copy) => {
    const activeMessage = copy.querySelector('[aria-hidden="false"]');
    return (activeMessage ?? copy).textContent?.trim();
  });

  try {
    await page.goto(`${BASE_URL}/?consentPreview=0&neoState=full`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator(".signal-stage canvas").waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForFunction(() => (
      document.querySelector(".experience")?.getAttribute("data-scene-ready") === "true"
    ), undefined, { timeout: 30_000 });
    await sleep(1_000);
    const restingBox = await page.locator(".discovery-copy").boundingBox();
    assert.equal(await activeFooterCopy(), "SUPERNEO™ © 2026 ACTUAL LTD.");
    assert.equal(await page.locator(".discovery-copy").getAttribute("data-found"), "false");

    await page.mouse.click(640, 360);
    await page.waitForFunction(() => (
      document.querySelector(".discovery-copy")?.getAttribute("data-found") === "true"
    ));
    assert.equal(await activeFooterCopy(), "YOU FOUND IT.");
    assert.deepEqual(await page.locator(".discovery-copy").boundingBox(), restingBox);

    await page.waitForFunction(() => (
      document.querySelector(".discovery-copy")?.getAttribute("data-found") === "false"
    ), undefined, { timeout: 6_000 });
    assert.equal(await activeFooterCopy(), "SUPERNEO™ © 2026 ACTUAL LTD.");
    assert.deepEqual(await page.locator(".discovery-copy").boundingBox(), restingBox);

    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await activeFooterCopy(), "SUPERNEO™ © 2026 ACTUAL LTD.");
    assert.equal(await page.locator(".discovery-copy").getAttribute("data-found"), "false");
  } finally {
    await context.close();
    await browser.close();
    await stopServer(server);
  }
});

test("Global Privacy Control is an automatic decline", { timeout: 90_000 }, async () => {
  const server = await startServer();
  const browser = await launchConsentBrowser();
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
    await page.goto(`${BASE_URL}/?analyticsQa=1&sceneFault=renderer`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3_200);
    const discoveryCopy = page.locator(".discovery-copy");
    const notice = discoveryCopy.locator(".discovery-message--notice");
    assert.equal(await notice.textContent(), "SUPERNEO™ © 2026 ACTUAL LTD.");
    assert.equal(await notice.getAttribute("aria-hidden"), "false");
    assert.equal(await discoveryCopy.getAttribute("data-found"), "false");
    const dock = page.locator(".analytics-consent-dock");
    assert.equal(await dock.isVisible(), true,
      "the development-only QA preview should remain visible under GPC");
    assert.equal(requests.length, 0);
    const consentCookie = (await context.cookies()).find((cookie) => cookie.name === "sn_consent");
    assert.ok(consentCookie, "GPC decline should be remembered");
    await dock.locator(".analytics-consent-actions button").first().click();
    await dock.waitFor({ state: "detached" });
    await sleep(400);
    assert.equal(requests.length, 0, "the QA preview must not override GPC collection");
  } finally {
    await context.close();
    await browser.close();
    await stopServer(server);
  }
});
