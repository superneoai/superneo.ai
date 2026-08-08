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
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*?--word-settle-y:\s*0\.15em/,
  );
  assert.match(
    styles,
    /\.stage-stack\[data-direction="backward"\][\s\S]*?--word-settle-y:\s*-0\.15em/,
  );
  assert.match(styles, /@keyframes stage-exit-up[\s\S]*?translate3d\(0, -0\.24em, 0\)/);
  assert.match(styles, /@keyframes stage-exit-down[\s\S]*?translate3d\(0, 0\.24em, 0\)/);
});
