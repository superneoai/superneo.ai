import assert from "node:assert/strict";
import test from "node:test";
import { createRenderProfile } from "../src/renderProfile.ts";

test("small screens use a bounded render budget and smaller composition", () => {
  const phone = createRenderProfile(393, 852, 3, true);
  const narrowPhone = createRenderProfile(320, 568, 2, true);
  const landscapePhone = createRenderProfile(852, 393, 3, true);
  const desktop = createRenderProfile(1440, 900, 2, false);
  const shortDesktop = createRenderProfile(1440, 400, 2, false);
  const largeDesktop = createRenderProfile(2560, 1440, 2, false);

  assert.equal(phone.compact, true);
  assert.equal(phone.bloomEnabled, true);
  assert.ok(phone.pixelRatio <= 1);
  assert.ok(393 * 852 * phone.pixelRatio ** 2 <= 420_001);
  assert.ok(phone.objectScale <= 0.9);
  assert.ok(narrowPhone.objectScale < phone.objectScale);
  assert.equal(narrowPhone.bloomEnabled, true);
  assert.equal(landscapePhone.compact, true);
  assert.equal(landscapePhone.bloomEnabled, true);
  assert.ok(852 * 393 * landscapePhone.pixelRatio ** 2 <= 420_001);
  assert.equal(desktop.compact, false);
  assert.equal(desktop.bloomEnabled, true);
  assert.equal(shortDesktop.bloomEnabled, true);
  assert.ok(desktop.pixelRatio <= 1.35);
  assert.equal(desktop.objectScale, 1);
  assert.ok(2560 * 1440 * largeDesktop.pixelRatio ** 2 <= 2_400_001);
});

test("touch tablets keep the layered scene within the compact pixel budget", () => {
  const tablet = createRenderProfile(768, 1024, 2, true);
  const renderedPixels = 768 * 1024 * tablet.pixelRatio ** 2;

  assert.equal(tablet.compact, true);
  assert.equal(tablet.bloomEnabled, true);
  assert.ok(tablet.pixelRatio <= 1);
  assert.ok(renderedPixels <= 720_001);
});

test("software renderers preserve desktop composition within a CI-safe pixel budget", () => {
  const softwareDesktop = createRenderProfile(1280, 720, 1, false, true);
  const renderedPixels = 1280 * 720 * softwareDesktop.pixelRatio ** 2;

  assert.equal(softwareDesktop.compact, false);
  assert.equal(softwareDesktop.objectScale, 1);
  assert.equal(softwareDesktop.fov, 32);
  assert.equal(softwareDesktop.bloomEnabled, true);
  assert.ok(renderedPixels <= 420_001);
});
