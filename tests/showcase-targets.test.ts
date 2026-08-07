import assert from "node:assert/strict";
import test from "node:test";
import {
  createShowcaseTargetAtlas,
  SHOWCASE_ACT_COUNT,
  SHOWCASE_COMPACT_CELLS,
  SHOWCASE_DESKTOP_CELLS,
} from "../src/showcaseTargets.ts";

test("the showcase atlas has four stable targets at desktop and mobile density", () => {
  assert.equal(SHOWCASE_ACT_COUNT, 4);
  assert.equal(SHOWCASE_DESKTOP_CELLS, 6144);
  assert.equal(SHOWCASE_COMPACT_CELLS, 2048);
  for (const count of [SHOWCASE_DESKTOP_CELLS, SHOWCASE_COMPACT_CELLS]) {
    const atlas = createShowcaseTargetAtlas(count);
    assert.equal(atlas.targets.length, 4);
    assert.equal(atlas.count, count);
    assert.equal(atlas.seed.length, count);
    for (const target of atlas.targets) {
      assert.equal(target.positionScale.length, count * 4);
      assert.equal(target.normal.length, count * 3);
      assert.equal(target.kind.length, count);
      assert.equal(target.route.length, count);
    }
  }
});

test("all four target datasets are deterministic and spatially distinct", () => {
  const left = createShowcaseTargetAtlas(512);
  const right = createShowcaseTargetAtlas(512);
  for (let target = 0; target < SHOWCASE_ACT_COUNT; target += 1) {
    assert.deepEqual(left.targets[target].positionScale, right.targets[target].positionScale);
    assert.deepEqual(left.targets[target].kind, right.targets[target].kind);
  }
  const signatures = left.targets.map((target) => {
    let signature = 0;
    for (let index = 0; index < target.positionScale.length; index += 17) {
      signature += target.positionScale[index] * (index + 1);
    }
    return Math.round(signature * 1000);
  });
  assert.equal(new Set(signatures).size, SHOWCASE_ACT_COUNT);
});

test("targets preserve normalized normals and bounded semantic routes", () => {
  const atlas = createShowcaseTargetAtlas(384);
  for (const target of atlas.targets) {
    for (let index = 0; index < atlas.count; index += 1) {
      const normalOffset = index * 3;
      const length = Math.hypot(
        target.normal[normalOffset],
        target.normal[normalOffset + 1],
        target.normal[normalOffset + 2],
      );
      assert.ok(Math.abs(length - 1) < 0.0001);
      assert.ok(target.route[index] >= 0 && target.route[index] <= 1);
      assert.ok(target.positionScale[index * 4 + 3] > 0);
    }
  }
});
