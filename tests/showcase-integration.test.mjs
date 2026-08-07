import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the four acts form one connected simulation system", async () => {
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");
  const events = await readFile(new URL("../src/showcaseEvents.ts", import.meta.url), "utf8");
  const engine = await readFile(new URL("../src/soundtrackEngine.ts", import.meta.url), "utf8");

  assert.match(field, /const MAX_ACTIVE_SIGNALS = 5/);
  assert.match(field, /signalProgressValues\.findIndex/);
  assert.match(field, /showcase\.update\(\{/);
  assert.match(field, /pointer: pointerWorld\.value/);
  assert.match(field, /signalProgress: signalProgressValues/);
  assert.match(field, /reducedMotion: motionIsReduced/);
  assert.match(field, /dispatchShowcaseImpulse/);
  assert.match(field, /dispatchShowcaseState/);
  assert.match(events, /"drive" \| "clash" \| "terrain" \| "orbit"/);
  assert.match(events, /SPD/);
  assert.match(events, /BONES/);
  assert.match(events, /CELLS/);
  assert.match(events, /SCALE/);
  assert.match(engine, /playShowcaseImpulse/);
  assert.match(engine, /drive: \{ frequency: 92/);
  assert.match(engine, /clash: \{ frequency: 184/);
  assert.match(engine, /terrain: \{ frequency: 72/);
  assert.match(engine, /orbit: \{ frequency: 246/);
});

test("the editorial composition preserves complete mobile parity", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");

  assert.match(app, /heading\.dataset\.depth = String\(index - stage\)/);
  assert.match(app, /className="signal-poster-atmosphere"/);
  assert.match(styles, /\.stage-panel\s*\{[\s\S]*?width:\s*min\(42rem, 44vw\)/);
  assert.match(styles, /\.stage-stack h2\s*\{[\s\S]*?font-size:\s*clamp\(3\.15rem, 5\.7vw, 6\.2rem\)/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.stage-panel\s*\{[\s\S]*?bottom:\s*9\.3rem/);
  assert.match(field, /Math\.max\(baseViewHeight \* aspect, 3\.08\)/);
  assert.match(field, /objectGroup\.scale\.setScalar\(renderProfile\.objectScale\)/);
  assert.match(field, /SHOWCASE_COMPACT_CELLS|createShowcaseMorphSystem\(renderProfile\.compact/);
});

test("the render stack uses one semantic bloom and one combined inspection pass", async () => {
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");
  const shader = await readFile(new URL("../src/latentShader.ts", import.meta.url), "utf8");

  assert.doesNotMatch(field, /UnrealBloomPass/);
  assert.match(field, /semanticBloomFragmentShader/);
  assert.match(shader, /semanticBloomFragmentShader/);
  assert.match(shader, /semanticLight/);
  assert.match(shader, /asciiDitherPostFragmentShader/);
});

test("the old membrane and creature pipeline are absent", async () => {
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");
  const shader = await readFile(new URL("../src/latentShader.ts", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.doesNotMatch(field, /neoform|TextureLoader|latent-field\.(?:avif|jpg)/i);
  assert.doesNotMatch(shader, /uArtwork|coverUv|imageZoom|imagePan/);
  assert.doesNotMatch(html, /latent-field\.(?:avif|jpg)/);
  assert.match(shader, /vec3 ink = vec3\(0\.006, 0\.003, 0\.014\)/);
  assert.match(shader, /float stars/);
  assert.match(shader, /float galaxyBand/);
});
