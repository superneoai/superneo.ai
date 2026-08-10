import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("the live site ships a globally opt-in consent surface", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const consent = await readFile(new URL("../src/privacy/consent.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../src/privacy/AnalyticsConsent.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(app, /data-consent-open=\{consentVisible\}/);
  assert.match(app, />\s*PRIVACY\s*<\/button>/);
  assert.match(consent, /mode: "opt-in"/);
  assert.match(consent, /autoShow: false/);
  assert.match(consent, /CONSENT_COOKIE_NAME = "sn_consent"/);
  assert.match(consent, /expiresAfterDays: 180/);
  assert.match(consent, /globalPrivacyControlEnabled\(\)/);
  assert.match(ui, /role="region"/);
  assert.match(ui, /aria-label="Analytics choices"/);
  assert.match(ui, /ALLOW ANALYTICS[\s\S]*DECLINE/);
  assert.match(ui, /dialog\.showModal\(\)/);
  assert.match(styles, /analytics-consent-actions button[\s\S]*min-height: 2\.75rem/);
  assert.match(styles, /privacy-preferences::backdrop/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*analytics-consent-dock/);
});

test("PostHog is lazy, allowlisted, minimized, and US-only", async () => {
  const client = await readFile(new URL("../src/analytics/client.ts", import.meta.url), "utf8");
  const config = await readFile(new URL("../src/analytics/runtimeConfig.ts", import.meta.url), "utf8");
  const events = await readFile(new URL("../src/analytics/events.ts", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

  assert.match(client, /import\("posthog-js"\)/);
  assert.doesNotMatch(client, /^import posthog/m);
  assert.match(client, /autocapture: false/);
  assert.match(client, /capture_pageview: false/);
  assert.match(client, /disable_session_recording: true/);
  assert.match(client, /person_profiles: "never"/);
  assert.match(client, /advanced_disable_flags: true/);
  assert.match(client, /opt_out_capturing_by_default: true/);
  assert.match(client, /captureEventName: false/);
  assert.match(client, /POSTHOG_STORAGE/);
  assert.match(config, /https:\/\/us\.i\.posthog\.com/);
  assert.match(events, /APPROVED_ANALYTICS_EVENTS/);
  assert.match(events, /stage_completed/);
  assert.match(events, /web_vital/);
  assert.match(workflow, /POSTHOG_PROJECT_KEY/);
  assert.match(workflow, /VITE_POSTHOG_HOST: https:\/\/us\.i\.posthog\.com/);
});

test("the production artifact contains the privacy notice without embedding a token", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const privacy = await readFile(new URL("../dist/privacy/index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /phc_[a-zA-Z0-9]+/);
  assert.match(privacy, /Analytics on superneo\.ai are optional/);
  assert.match(privacy, /PostHog Cloud US/);
  assert.match(privacy, /no more\s+than 12 months/i);
  assert.match(privacy, /Global Privacy Control/);
  await access(new URL("../dist/privacy/index.html", import.meta.url));
});
