import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile stage motion opposes the finger direction", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );

  assert.match(app, /previousHeading\.dataset\.exiting = direction/);
  assert.doesNotMatch(app, /setExitStage/);
  assert.match(field, /self\.direction \* scrollEnergy \* 0\.16/);
  assert.match(field, /objectGroup\.position\.y = scrollLift/);
  assert.match(app, /const WORD_GLIDE_DISTANCE_EM = 0\.29557/);
  assert.match(app, /const WORD_GLIDE_BEZIER = \[1 \/ 3, 4 \/ 15, 2 \/ 3, 11 \/ 15\] as const/);
  assert.match(app, /const MOBILE_WORD_TRAVEL = \{ x: 0, y: WORD_GLIDE_DISTANCE_EM \}/);
  assert.match(app, /const easedStageProgress = easeWordGlide\(stageProgress\)/);
  assert.match(app, /const remaining = reducedMotion\.matches \? 0 : 1 - easedStageProgress/);
  assert.match(app, /travel\.y \* remaining/);
  assert.match(styles, /@keyframes stage-exit-up[\s\S]*?translate3d\(0, -0\.24em, 0\)/);
  assert.match(styles, /@keyframes stage-exit-down[\s\S]*?translate3d\(0, 0\.24em, 0\)/);
});
