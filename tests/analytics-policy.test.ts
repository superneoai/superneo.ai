import assert from "node:assert/strict";
import test from "node:test";
import {
  OUTBOUND_DESTINATION_CATEGORIES,
  outboundAnalyticsProperties,
  sanitizeAnalyticsEventDetail,
} from "../src/analytics/events.ts";
import {
  analyticsContext,
  deviceClass,
  isAnalyticsRuntimeAllowed,
  normalizeCampaignValue,
  safeReferrerHost,
  volumeBucket,
} from "../src/analytics/policy.ts";

test("analytics events carry stable surface and environment dimensions", () => {
  assert.deepEqual(analyticsContext(false), {
    surface: "landing",
    environment: "development",
  });
  assert.deepEqual(analyticsContext(true), {
    surface: "landing",
    environment: "production",
  });
});

test("analytics runs only with a token on the live host or an explicit dev QA route", () => {
  assert.equal(isAnalyticsRuntimeAllowed({
    hostname: "superneo.ai",
    isDevelopment: false,
    qaRequested: false,
    projectKey: "phc_live",
  }), true);
  assert.equal(isAnalyticsRuntimeAllowed({
    hostname: "superneo.ai",
    isDevelopment: false,
    qaRequested: false,
    projectKey: "",
  }), false);
  assert.equal(isAnalyticsRuntimeAllowed({
    hostname: "localhost",
    isDevelopment: true,
    qaRequested: false,
    projectKey: "phc_test",
  }), false);
  assert.equal(isAnalyticsRuntimeAllowed({
    hostname: "localhost",
    isDevelopment: true,
    qaRequested: true,
    projectKey: "phc_test",
  }), true);
  assert.equal(isAnalyticsRuntimeAllowed({
    hostname: "preview.example",
    isDevelopment: false,
    qaRequested: true,
    projectKey: "phc_test",
  }), false);
});

test("outbound destination categories are bounded and URL-free", () => {
  assert.deepEqual(OUTBOUND_DESTINATION_CATEGORIES, ["email", "legal", "privacy", "x"]);
  assert.deepEqual(outboundAnalyticsProperties("x"), { destination: "x" });
  assert.equal(outboundAnalyticsProperties("https://x.com/superneoai?private=yes"), undefined);
  assert.deepEqual(sanitizeAnalyticsEventDetail({
    name: "outbound_clicked",
    properties: {
      destination: "privacy",
      url: "https://superneo.ai/privacy/?private=yes",
      query: "private=yes",
    },
  }), {
    name: "outbound_clicked",
    properties: { destination: "privacy" },
  });
  assert.equal(sanitizeAnalyticsEventDetail({
    name: "outbound_clicked",
    properties: { destination: "https://example.com/private?secret=yes" },
  }), undefined);
});

test("analytics properties are coarse and bounded", () => {
  assert.equal(normalizeCampaignValue("launch / email?private=yes"), "launch-email-private-yes");
  assert.equal(normalizeCampaignValue("a".repeat(90))?.length, 64);
  assert.equal(safeReferrerHost("https://example.com/private/path?q=secret"), "example.com");
  assert.equal(safeReferrerHost("not a url"), undefined);
  assert.equal(volumeBucket(46), 50);
  assert.equal(volumeBucket(1000), 100);
  assert.equal(deviceClass(390, false), "mobile");
  assert.equal(deviceClass(1280, false), "desktop");
  assert.equal(deviceClass(1280, true), "mobile");
});
