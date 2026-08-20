import assert from "node:assert/strict";
import test from "node:test";
import {
  LAST_STAGE,
  STAGE_COUNT,
  toMorphPhase,
  toStageIndex,
  toStageProgress,
} from "../src/morphTimeline.ts";

test("shape checkpoints match the three text checkpoints", () => {
  assert.equal(STAGE_COUNT, 3);
  assert.equal(LAST_STAGE, 2);
  for (const [progress, expectedPhase] of [
    [0, 0],
    [1 / 3, 1],
    [2 / 3, 2],
    [1, 2],
  ] as const) {
    assert.equal(toMorphPhase(progress), expectedPhase);
  }
});

test("text, meters, and shape select the same stage throughout the runway", () => {
  for (let step = 0; step <= 100; step += 1) {
    const progress = step / 100;
    const phase = toMorphPhase(progress);
    const stage = toStageIndex(progress);
    assert.equal(stage, Math.floor(phase));
    for (let index = 0; index < STAGE_COUNT; index += 1) {
      const meter = toStageProgress(progress, index);
      if (index < stage) assert.equal(meter, 1);
      if (index > stage) assert.equal(meter, 0);
    }
    if (stage < LAST_STAGE) {
      assert.ok(Math.abs(toStageProgress(progress, stage) - (phase - stage)) < 1e-9);
    } else {
      assert.equal(phase, LAST_STAGE);
    }
  }
});
