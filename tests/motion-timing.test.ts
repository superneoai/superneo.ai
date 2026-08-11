import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedFrameDelta,
  frameAdjustedBlend,
  frameAdjustedRetention,
} from "../src/motionTiming.ts";

test("motion timing preserves the existing 60 Hz response", () => {
  assert.ok(Math.abs(frameAdjustedBlend(0.16, 1 / 60) - 0.16) < 1e-12);
  assert.ok(Math.abs(frameAdjustedRetention(0.86, 1 / 60) - 0.86) < 1e-12);
});

test("motion timing is stable when a frame spans multiple reference frames", () => {
  const twoFrameBlend = frameAdjustedBlend(0.16, 2 / 60);
  const twoFrameRetention = frameAdjustedRetention(0.86, 2 / 60);

  assert.ok(Math.abs(twoFrameBlend - (1 - 0.84 ** 2)) < 1e-12);
  assert.ok(Math.abs(twoFrameRetention - 0.86 ** 2) < 1e-12);
  assert.equal(boundedFrameDelta(2_000, 1_000), 0.25);
  assert.equal(boundedFrameDelta(900, 1_000), 0);
});
