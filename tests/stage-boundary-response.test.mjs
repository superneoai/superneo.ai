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
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );

  const headingRule = styles.match(/\.stage-stack h2 \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(headingRule, /transition: none/);
  assert.doesNotMatch(field, /targetVelocity = Math\.max\(targetVelocity, 0\.4\)/);
  assert.doesNotMatch(shader, /float stagePhase\(/);
  assert.match(shader, /float basePhase = uStagePhase/);
  assert.match(shader, /float glyphPhase = uStagePhase/);
  assert.match(field, /stagePhaseUniform\.value = toMorphPhase\(progress\)/);
  assert.match(field, /const phase = stagePhaseUniform\.value/);
  assert.match(shader, /smoothstep\(1\.32, 1\.68, glyphPhase\)/);
  assert.doesNotMatch(shader, /clamp\([^;\n]*\) \* 3\.0/);
  assert.doesNotMatch(field, /scrollUniform\.value \* 3/);
});

test("stage copy bypasses React reconciliation on the critical scroll frame", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const progress = await readFile(new URL("../src/sceneProgress.ts", import.meta.url), "utf8");

  assert.match(progress, /dispatchStageChange\(nextStage, previousStage\)/);
  assert.match(app, /window\.addEventListener\(STAGE_CHANGE_EVENT, syncStage\)/);
  assert.match(app, /heading\.dataset\.state = index === stage/);
  assert.match(app, /heading\.dataset\.depth = String\(index - stage\)/);
  assert.doesNotMatch(app, /\b(?:startTransition|setStage)\b/);
  assert.doesNotMatch(app, /useState\(0\)/);
});
