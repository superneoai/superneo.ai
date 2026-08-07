import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("stage boundaries respond immediately without a synthetic visual tail", async () => {
  const styles = await readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );
  const rig = await readFile(new URL("../src/neoformRig.ts", import.meta.url), "utf8");
  const world = await readFile(new URL("../src/neoformWorld.ts", import.meta.url), "utf8");

  const headingRule = styles.match(/\.stage-stack h2 \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(headingRule, /transition: none/);
  assert.doesNotMatch(field, /targetVelocity = Math\.max\(targetVelocity, 0\.4\)/);
  assert.match(field, /stagePhaseUniform\.value = toMorphPhase\(progress\)/);
  assert.match(field, /const semanticPhase = stagePhaseUniform\.value/);
  assert.match(field, /formBlend = THREE\.MathUtils\.smoothstep\(semanticPhase, 1\.18, 2\.28\)/);
  assert.match(field, /phase: semanticPhase/);
  assert.match(rig, /const formBlend = smoothstep\(0, 1, input\.formBlend\)/);
  assert.match(world, /uniforms\.uPhase\.value = input\.phase/);
  assert.doesNotMatch(field, /scrollUniform\.value \* 3/);
});

test("stage copy bypasses React reconciliation on the critical scroll frame", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");

  assert.match(field, /dispatchStageChange\(nextStage, previousStage\)/);
  assert.match(app, /window\.addEventListener\(STAGE_CHANGE_EVENT, syncStage\)/);
  assert.match(app, /heading\.dataset\.state = index === stage/);
  assert.match(app, /heading\.dataset\.depth = String\(index - stage\)/);
  assert.doesNotMatch(app, /\b(?:startTransition|setStage)\b/);
  assert.doesNotMatch(app, /useState\(0\)/);
});
