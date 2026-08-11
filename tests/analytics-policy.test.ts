import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsContext,
  deviceClass,
  isAnalyticsRuntimeAllowed,
  normalizeCampaignValue,
  safeReferrerHost,
  volumeBucket,
} from "../src/analytics/policy.ts";
import { sanitizeAnalyticsEventProperties } from "../src/analytics/events.ts";

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
    ipDiscardConfirmed: true,
  }), true);
  assert.equal(isAnalyticsRuntimeAllowed({
    hostname: "superneo.ai",
    isDevelopment: false,
    qaRequested: false,
    projectKey: "",
    ipDiscardConfirmed: true,
  }), false);
  assert.equal(isAnalyticsRuntimeAllowed({
    hostname: "localhost",
    isDevelopment: true,
    qaRequested: false,
    projectKey: "phc_test",
    ipDiscardConfirmed: true,
  }), false);
  assert.equal(isAnalyticsRuntimeAllowed({
    hostname: "localhost",
    isDevelopment: true,
    qaRequested: true,
    projectKey: "phc_test",
    ipDiscardConfirmed: true,
  }), true);
  assert.equal(isAnalyticsRuntimeAllowed({
    hostname: "preview.example",
    isDevelopment: false,
    qaRequested: true,
    projectKey: "phc_test",
    ipDiscardConfirmed: true,
  }), false);
  assert.equal(isAnalyticsRuntimeAllowed({
    hostname: "superneo.ai",
    isDevelopment: false,
    qaRequested: false,
    projectKey: "phc_live",
    ipDiscardConfirmed: false,
  }), false);
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

test("analytics payloads keep only approved event and transport properties", () => {
  assert.deepEqual(
    sanitizeAnalyticsEventProperties("audio_toggled", {
      token: "phc_test",
      distinct_id: "anonymous-id",
      $device_id: "anonymous-id",
      $lib: "web",
      $lib_version: "1.0",
      $insert_id: "dedupe-id",
      $process_person_profile: false,
      $browser: "Chrome",
      $browser_version: 140,
      $os: "Mac OS X",
      $screen_width: 390,
      $screen_height: 844,
      $timezone: "Asia/Bangkok",
      $browser_language: "en-US",
      surface: "landing",
      environment: "production",
      state: "playing",
      unapproved: "private",
    }),
    {
      token: "phc_test",
      distinct_id: "anonymous-id",
      $device_id: "anonymous-id",
      $lib: "web",
      $lib_version: "1.0",
      $insert_id: "dedupe-id",
      $process_person_profile: false,
      $geoip_disable: true,
      surface: "landing",
      environment: "production",
      state: "playing",
    },
  );
});
