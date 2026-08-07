import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("the scene poster crossfades through the first valid WebGL frame", async () => {
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );
  const app = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  const baseStyles = styles.slice(0, styles.indexOf("@media (max-width: 720px)"));
  const avif = await readFile(
    new URL("../public/latent-field.avif", import.meta.url),
  );

  await access(new URL("../public/latent-field.jpg", import.meta.url));
  assert.equal(avif.includes(Buffer.from("grid")), false);
  assert.equal(avif.includes(Buffer.from("dimg")), false);
  assert.match(field, /"latent-field\.avif",\s*"latent-field\.jpg"/);
  assert.match(field, /onSceneStateChange:\s*\(ready:\s*boolean\)\s*=>\s*void/);
  assert.match(field, /onSceneStateChange\(false\)/);
  assert.match(field, /reportSceneState\(true\)/);
  assert.match(field, /renderer\.debug\.onShaderError/);
  assert.match(field, /shaderHealthy/);
  assert.match(field, /WEBGL_lose_context/);
  assert.match(field, /webglcontextlost/);
  assert.match(field, /webglcontextrestored/);
  assert.match(app, /data-scene-ready=\{sceneReady\}/);
  assert.match(app, /className="signal-poster"/);
  assert.match(app, /signal-artwork-fallback--desktop/);
  assert.match(app, /signal-artwork-fallback--mobile/);
  assert.match(app, /className="scene-loader"/);
  assert.match(app, /SYSTEM BOOT/);
  assert.match(app, /RUNTIME/);
  assert.match(app, /FIELD/);
  assert.match(app, /SIGNAL/);
  assert.match(app, /SCENE/);
  assert.match(app, /const SCENE_LOADING_STEP_MS = 300/);
  assert.match(app, /const INITIALIZING_LINGER_BASE_MS = 550/);
  assert.match(app, /const INITIALIZING_LINGER_JITTER_MS = 350/);
  assert.match(app, /Math\.floor\(Math\.random\(\) \* INITIALIZING_LINGER_JITTER_MS\)/);
  assert.match(app, /Math\.max\(0, MIN_SCENE_LOADING_MS - elapsed\)/);
  assert.match(app, /\[2, 3, 4, 5\]\.map/);
  assert.match(app, /className="scene-loader-final" data-visible=\{finalizing\}/);
  assert.match(app, />INITIALIZING<\/span>/);
  assert.match(app, /state === "complete" \? "OK" : state === "active" \? phase\.activity : "WAIT"/);
  assert.match(app, /className="scene-loader-track"/);
  assert.match(
    baseStyles,
    /\.signal-poster \.signal-artwork-fallback--desktop\s*\{[\s\S]*?display:\s*block/,
  );
  assert.match(
    styles,
    /\.signal-stage\s*\{[\s\S]*?opacity:\s*0[\s\S]*?visibility:\s*hidden[\s\S]*?transition:/,
  );
  assert.match(
    styles,
    /data-scene-ready="true"[\s\S]*?\.signal-stage\s*\{[\s\S]*?opacity:\s*1[\s\S]*?visibility:\s*visible/,
  );
  assert.match(
    styles,
    /data-scene-ready="true"[\s\S]*?\.signal-poster\s*\{[\s\S]*?opacity:\s*0[\s\S]*?visibility:\s*hidden/,
  );
  const readyPosterRule = styles.match(
    /\.experience\[data-scene-ready="true"\] \.signal-poster\s*\{([^}]*)\}/,
  );
  assert.ok(readyPosterRule, "expected the ready poster rule");
  assert.doesNotMatch(readyPosterRule[1], /display:\s*none/);
  assert.match(
    styles,
    /\.signal-artwork-fallback\s*\{[\s\S]*?inset:\s*0;/,
  );
  assert.doesNotMatch(styles, /mobile-background-drift/);
  assert.match(
    styles,
    /\.signal-artwork-fallback\s*\{[\s\S]*?filter:\s*blur\(1\.55rem\) brightness\(0\.42\) saturate\(0\.58\)/,
  );
  assert.match(
    styles,
    /\.signal-poster::before\s*\{[\s\S]*?var\(--ink\) 72%/,
  );
  assert.match(styles, /\.signal-poster::after\s*\{[\s\S]*?scene-loader-scan/);
  assert.match(styles, /\.scene-loader-step\[data-state="active"\]/);
  assert.match(styles, /\.scene-loader-track > i\[data-state="active"\]/);
  assert.match(styles, /@keyframes scene-loader-neon-step/);
  assert.match(styles, /@keyframes scene-loader-dot/);
  assert.match(styles, /\.scene-loader-final output span:nth-child\(3\)/);
  assert.match(
    styles,
    /\.experience:not\(\[data-scene-ready="true"\]\) > :is\([\s\S]*?\.site-header,[\s\S]*?\.stage-panel,[\s\S]*?\.site-footer[\s\S]*?visibility:\s*hidden/,
  );
  assert.doesNotMatch(styles, /@keyframes scene-loader-progress/);
  assert.doesNotMatch(styles, /@keyframes scene-loader-code/);
  assert.match(field, /sceneRevealStartedAt/);
  assert.match(field, /validFrameCount\s*>=\s*2/);
  assert.match(
    field,
    /uCompactLayout\.value\s*=\s*THREE\.MathUtils\.lerp\(\s*1,[\s\S]*?sceneReveal\.value/,
  );
  assert.match(
    field,
    /needsRender\s*=\s*\(sceneReady\s*&&\s*sceneReveal\.value\s*<\s*1\)/,
  );
});

test("the WebGL scene stays opaque and never composites the fallback artwork", async () => {
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );

  assert.match(field, /new THREE\.WebGLRenderer\(\{[\s\S]*?alpha:\s*false/);
  assert.match(field, /renderer\.setClearColor\(0x030403,\s*1\)/);
  assert.match(field, /return <div ref=\{hostRef\} className="signal-stage" aria-hidden="true" \/>/);
  assert.doesNotMatch(
    styles,
    /\.signal-stage \.signal-artwork-fallback--(?:desktop|mobile)[\s\S]*?display:\s*block/,
  );
  assert.match(shader, /gl_FragColor\s*=\s*vec4\(color,\s*1\.0\)/);
});

test("the background shader declares every uniform it reads", async () => {
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );
  const background = shader.slice(
    shader.indexOf("export const backgroundFragmentShader"),
    shader.indexOf("export const postVertexShader"),
  );

  assert.match(background, /uniform vec3 uSignalColor;/);
  assert.match(background, /mix\(color, uSignalColor,/);
});
