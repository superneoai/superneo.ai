import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("mobile layout covers narrow, notched, touch, and short screens", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");
  const rig = await readFile(new URL("../src/neoformRig.ts", import.meta.url), "utf8");
  const world = await readFile(new URL("../src/neoformWorld.ts", import.meta.url), "utf8");
  const shader = await readFile(new URL("../src/latentShader.ts", import.meta.url), "utf8");
  const profile = await readFile(new URL("../src/renderProfile.ts", import.meta.url), "utf8");

  assert.match(html, /viewport-fit=cover/);
  assert.match(
    html,
    /href="\.\/latent-field\.avif"[^>]*media="\(min-width: 721px\)"/,
  );
  assert.match(
    html,
    /href="\.\/latent-field-mobile\.jpg"[^>]*media="\(max-width: 720px\)"/,
  );
  assert.doesNotMatch(html, /href="\.\/neo-sign\.png/);
  assert.match(styles, /@media \(max-width: 480px\)/);
  assert.match(styles, /@media \(max-width: 420px\) and \(orientation: portrait\)/);
  assert.match(styles, /@media \(max-width: 350px\)/);
  assert.match(styles, /@media \(max-height: 560px\) and \(max-width: 900px\)/);
  assert.match(styles, /@media \(hover: none\) and \(pointer: coarse\)/);
  assert.match(styles, /\.soundtrack-volume\s*\{\s*display: none;/);
  assert.match(styles, /env\(safe-area-inset-top/);
  assert.match(styles, /env\(safe-area-inset-bottom/);
  assert.match(styles, /min-height: 2\.75rem/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(styles, /contain: layout paint size/);
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*?\.scene-loader\s*\{[\s\S]*?width:\s*min\(16\.5rem, calc\(100vw - 3rem\)\)/,
  );
  assert.match(styles, /\.making-line\s*\{[^}]*writing-mode: vertical-rl/s);
  assert.match(styles, /\.making-line\s*\{[^}]*transform: translateY\(-50%\) rotate\(180deg\)/s);
  assert.match(profile, /PHONE_PIXEL_BUDGET = 420_000/);
  assert.match(profile, /COMPACT_PIXEL_BUDGET = 720_000/);
  assert.match(profile, /PHONE_MAX_DPR = 1/);
  assert.match(profile, /bloomEnabled: true/);
  assert.doesNotMatch(profile, /bloomEnabled: !phone/);
  assert.match(app, /lazy\(\(\) =>/);
  assert.match(app, /import\("\.\/LatentField"\)/);
  assert.match(app, /desktopArtworkUrl = new URL\("latent-field\.avif"/);
  assert.match(app, /<Suspense fallback=\{null\}>/);
  assert.match(field, /createNeoformRig\(renderProfile\.compact\)/);
  assert.doesNotMatch(field, /window\.visualViewport\?\.addEventListener\("resize", scheduleResize/);
  assert.match(field, /host\.clientWidth/);
  assert.match(field, /host\.clientHeight/);
  assert.match(field, /window\.addEventListener\("pointermove", schedulePointer/);
  assert.match(field, /window\.requestAnimationFrame\(\(\) =>/);
  assert.match(field, /window\.cancelAnimationFrame\(pointerMoveFrame\)/);
  assert.match(field, /const pointerWidth = lastViewportWidth \|\| Math\.max\(host\.clientWidth, 1\)/);
  assert.match(field, /const pointerHeight = lastViewportHeight \|\| Math\.max\(host\.clientHeight, 1\)/);
  assert.match(field, /bloomPass\.enabled = renderProfile\.bloomEnabled/);
  assert.match(rig, /createNeoformRig\(compact: boolean\)/);
  assert.match(rig, /new THREE\.InstancedMesh/);
  assert.match(rig, /past\.group\.visible = input\.predictionStrength/);
  assert.match(rig, /future\.group\.visible = input\.predictionStrength/);
  assert.match(world, /compact \? COMPACT_SWARM_COUNT : DESKTOP_SWARM_COUNT/);
  assert.match(world, /COMPACT_SWARM_COUNT = 260/);
  await access(new URL("../public/latent-field-mobile.jpg", import.meta.url));
  assert.match(field, /renderProfile\.compact\s*\? \["latent-field-mobile\.jpg"\]/);
  assert.match(field, /textureImage\.naturalWidth \|\| textureImage\.width/);
  assert.match(field, /alpha: false/);
  assert.match(field, /renderer\.setClearColor\(0x030403, 1\)/);
  assert.match(styles, /\.signal-artwork-fallback/);
  assert.match(shader, /gl_FragColor = vec4\(color, sourceSample\.a\)/);
  assert.doesNotMatch(shader, /max\(scale\.x, 0\.42\)/);
  assert.doesNotMatch(field, /openScaleReduction|openTransition/);
  assert.match(shader, /mix\(0\.93, 1\.0, uCompactLayout\)/);
});
