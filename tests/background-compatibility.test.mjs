import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("the scene poster stays visible until the first valid WebGL frame", async () => {
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
  assert.match(field, /webglcontextlost/);
  assert.match(field, /webglcontextrestored/);
  assert.match(app, /data-scene-ready=\{sceneReady\}/);
  assert.match(app, /className="signal-poster"/);
  assert.match(app, /signal-artwork-fallback--desktop/);
  assert.match(app, /signal-artwork-fallback--mobile/);
  assert.match(
    baseStyles,
    /\.signal-poster \.signal-artwork-fallback--desktop\s*\{[\s\S]*?display:\s*block/,
  );
  assert.match(styles, /data-scene-ready="true"[\s\S]*?\.signal-poster\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /data-scene-ready="false"[\s\S]*?\.signal-stage\s*\{[\s\S]*?visibility:\s*hidden/);
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
