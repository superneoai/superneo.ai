import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile keeps the complete reel within bounded responsive budgets", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");
  const targets = await readFile(new URL("../src/showcaseTargets.ts", import.meta.url), "utf8");
  const profile = await readFile(new URL("../src/renderProfile.ts", import.meta.url), "utf8");

  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /latent-field\.(?:avif|jpg)/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /@media \(max-width: 480px\)/);
  assert.match(styles, /@media \(max-width: 420px\) and \(orientation: portrait\)/);
  assert.match(styles, /@media \(max-height: 560px\) and \(max-width: 900px\)/);
  assert.match(styles, /env\(safe-area-inset-top/);
  assert.match(styles, /env\(safe-area-inset-bottom/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(styles, /height:\s*100lvh/);
  assert.match(styles, /\.soundtrack-volume\s*\{\s*display: none;/);
  assert.match(styles, /\.making-line\s*\{[^}]*writing-mode: vertical-rl/s);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.stage-panel\s*\{[\s\S]*?top:\s*auto/);

  assert.match(profile, /PHONE_PIXEL_BUDGET = 420_000/);
  assert.match(profile, /COMPACT_PIXEL_BUDGET = 720_000/);
  assert.match(profile, /PHONE_MAX_DPR = 1/);
  assert.match(targets, /SHOWCASE_COMPACT_CELLS = 2048/);
  assert.match(field, /createShowcaseMorphSystem\(renderProfile\.compact/);
  assert.match(field, /Math\.max\(baseViewHeight \* aspect, 3\.08\)/);
  assert.match(field, /objectGroup\.scale\.setScalar\(renderProfile\.objectScale\)/);
  assert.match(field, /host\.clientWidth/);
  assert.match(field, /host\.clientHeight/);
  assert.match(field, /window\.requestAnimationFrame/);
  assert.doesNotMatch(field, /visualViewport\?\.addEventListener\("resize"/);
  assert.doesNotMatch(field, /openScaleReduction|openTransition/);
});
