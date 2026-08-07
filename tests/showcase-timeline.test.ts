import assert from "node:assert/strict";
import test from "node:test";
import { toShowcaseTimeline } from "../src/showcaseTimeline.ts";

test("each quarter dwells on one readable showcase before morphing", () => {
  assert.deepEqual(toShowcaseTimeline(0), {
    stage: 0,
    fromAct: 0,
    toAct: 1,
    transition: 0,
    actProgress: 0,
  });
  assert.equal(toShowcaseTimeline(0.1).transition, 0);
  assert.equal(toShowcaseTimeline(0.24).transition, 1);
  assert.deepEqual(toShowcaseTimeline(0.25), {
    stage: 1,
    fromAct: 1,
    toAct: 2,
    transition: 0,
    actProgress: 0,
  });
});

test("the final act uses its local progress for earth to galaxy scale", () => {
  const earth = toShowcaseTimeline(0.75);
  const galaxy = toShowcaseTimeline(1);
  assert.equal(earth.fromAct, 3);
  assert.equal(earth.toAct, 3);
  assert.equal(earth.actProgress, 0);
  assert.equal(galaxy.actProgress, 1);
  assert.equal(galaxy.transition, 0);
});
