import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("the live site ships a globally opt-in consent surface", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const consent = await readFile(new URL("../src/privacy/consent.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../src/privacy/AnalyticsConsent.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(app, /data-consent-open=\{consentVisible\}/);
  assert.match(app, /consent\.status === "pending" \|\| analyticsConsentPreviewMode/);
  assert.match(app, /setConsentPreviewDismissed\(true\)/);
  assert.match(app, /<a[\s\S]*?href="\.\/privacy\/"[\s\S]*?>\s*PRIVACY\s*<\/a>/);
  assert.match(app, /<nav className="footer-privacy" aria-label="Site information">[\s\S]*?href="\.\/privacy\/"[\s\S]*?href="\.\/legal\/">LEGAL<\/a>[\s\S]*?<\/nav>/);
  assert.match(app, /<footer className="site-footer">[\s\S]*?<nav className="contact-links" aria-label="Contact">[\s\S]*?x\.com\/superneoai[\s\S]*?mailto:hello@superneo\.ai[\s\S]*?<\/footer>/);
  assert.match(consent, /mode: "opt-in"/);
  assert.match(consent, /autoShow: false/);
  assert.match(consent, /CONSENT_COOKIE_NAME = "sn_consent"/);
  assert.match(consent, /CONSENT_REVISION = 2/);
  assert.match(consent, /expiresAfterDays: 180/);
  assert.match(consent, /globalPrivacyControlEnabled\(\)/);
  assert.match(ui, /role="region"/);
  assert.match(ui, /aria-label="Analytics choices"/);
  assert.match(ui, /data-nosnippet=""/);
  assert.match(ui, /data-state=\{!visible \|\| exiting \? "closing" : "open"\}/);
  assert.match(ui, /SUPERNEO uses optional PostHog US analytics/);
  assert.match(ui, /ALLOW ANALYTICS[\s\S]*DECLINE ANALYTICS/);
  assert.match(ui, /dialog\.showModal\(\)/);
  assert.match(ui, /document\.activeElement/);
  assert.match(ui, /returnTarget\?\.isConnected/);
  assert.match(styles, /analytics-consent-actions button[\s\S]*min-height: 2\.75rem/);
  assert.match(styles, /analytics-consent-dock[\s\S]*width: min\(50rem,/);
  assert.match(styles, /@keyframes consent-dock-out/);
  assert.match(styles, /--consent-motion-duration: 360ms/);
  assert.match(styles, /\.stage-panel,[\s\S]*\.site-footer[\s\S]*transition:\s*bottom var\(--consent-motion-duration\)/);
  assert.match(styles, /\.footer-privacy\s*\{[\s\S]*?bottom:\s*0[\s\S]*?left:\s*50%[\s\S]*?display:\s*flex[\s\S]*?transform:\s*translateX\(-50%\)/);
  assert.match(styles, /privacy-preferences::backdrop/);
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?\.privacy-preference-list section\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(styles, /@media \(max-width: 350px\)[\s\S]*?\.analytics-consent-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*analytics-consent-dock/);
});

test("PostHog is lazy, allowlisted, minimized, and US-only", async () => {
  const client = await readFile(new URL("../src/analytics/client.ts", import.meta.url), "utf8");
  const config = await readFile(new URL("../src/analytics/runtimeConfig.ts", import.meta.url), "utf8");
  const events = await readFile(new URL("../src/analytics/events.ts", import.meta.url), "utf8");
  const runtime = await readFile(
    new URL("../src/analytics/AnalyticsRuntime.tsx", import.meta.url),
    "utf8",
  );
  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

  assert.match(client, /import\("posthog-js"\)/);
  assert.doesNotMatch(client, /^import posthog/m);
  assert.match(client, /autocapture: false/);
  assert.match(client, /capture_pageview: false/);
  assert.match(client, /ip: false/);
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
  assert.match(runtime, /const stageNames = \["latent", "emergence", "superneo"\]/);
  assert.match(runtime, /stage === LAST_STAGE/);
  assert.doesNotMatch(runtime, /spark|swarm|inference|stage === 3/);
  assert.match(workflow, /POSTHOG_PROJECT_KEY/);
  assert.match(workflow, /VITE_POSTHOG_HOST: https:\/\/us\.i\.posthog\.com/);
});

test("the production artifact contains the privacy notice without embedding a token", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const privacy = await readFile(new URL("../dist/privacy/index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /phc_[a-zA-Z0-9]+/);
  assert.match(privacy, /Analytics on superneo\.ai are optional/);
  assert.match(privacy, /ACTUAL LTD\. operates superneo\.ai, the website of/);
  assert.match(privacy, /ACTUAL LTD\. is the\s+controller/);
  assert.match(privacy, /decides why and how it processes/);
  assert.match(privacy, /PostHog Cloud US/);
  assert.match(privacy, /maximum of 12 months/i);
  assert.match(privacy, /Global Privacy Control/);
  assert.match(privacy, /EFFECTIVE 2026-08-19 \/\/ CONSENT REVISION 02/);
  assert.doesNotMatch(privacy, /SUPERNEO does not|analytics for SUPERNEO/);
  await access(new URL("../dist/privacy/index.html", import.meta.url));
});
