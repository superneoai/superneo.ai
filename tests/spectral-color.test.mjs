import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the procedural actor and biome share a broad cool-neon palette", async () => {
  const rig = await readFile(new URL("../src/neoformRig.ts", import.meta.url), "utf8");
  const world = await readFile(new URL("../src/neoformWorld.ts", import.meta.url), "utf8");

  for (const color of ["#ff2a87", "#9a28ff", "#4e38ff", "#087cff", "#29d7ff", "#899dff"]) {
    assert.match(rig, new RegExp(color));
  }
  assert.match(rig, /coolSpectralColor/);
  assert.match(world, /vec3 violet/);
  assert.match(world, /vec3 electricBlue/);
  assert.match(world, /vec3 ice/);
});

test("the atmospheric spectral loop continuously visits its complete palette", async () => {
  const shader = await readFile(new URL("../src/latentShader.ts", import.meta.url), "utf8");

  for (const colorStop of [
    "hotPinkTone",
    "magentaTone",
    "ultravioletTone",
    "violetTone",
    "indigoTone",
    "electricBlue",
    "flameBlue",
    "iceBlue",
    "periwinkleTone",
    "orchidTone",
  ]) {
    assert.match(shader, new RegExp(`vec3 ${colorStop} = vec3`));
  }
  assert.match(shader, /vec3 cubicPalette/);
  assert.match(shader, /fract\(time \* 0\.07/);
  assert.match(shader, /phase \* 10\.0/);
});

test("green remains localized to the core, contacts, and propagated signals", async () => {
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");
  const rig = await readFile(new URL("../src/neoformRig.ts", import.meta.url), "utf8");
  const world = await readFile(new URL("../src/neoformWorld.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(styles, /--signal:\s*#[\da-f]{6}/i);
  assert.match(field, /getPropertyValue\("--signal"\)/);
  assert.match(field, /new THREE\.Color\(signalColor\)/);
  assert.match(rig, /color:\s*0xbaf628/);
  assert.match(rig, /color\.lerp\(signalColor, signal \* 0\.92\)/);
  assert.match(world, /color = mix\(color, uSignalColor, vSignal \* 0\.68\)/);
  assert.match(world, /pulseSignal = max\(pulseSignal, ring \* dissolve\)/);
  assert.match(field, /bloomPass\.strength = 0\.16 \+ interactionEnergy \* 0\.2 \+ signalEnergy \* 0\.04/);
  assert.doesNotMatch(world, /background|clearColor/i);
});

test("pointer activity cannot wash the whole ASCII field green", async () => {
  const shader = await readFile(new URL("../src/latentShader.ts", import.meta.url), "utf8");
  const post = shader.slice(shader.indexOf("export const asciiDitherPostFragmentShader"));

  assert.match(post, /uInteraction \* 0\.06 \+ edge \* 0\.04/);
  assert.doesNotMatch(post, /uInteraction \* 0\.2[\d]/);
});

test("the traveling head reaches every extremity before dissolving", async () => {
  const rig = await readFile(new URL("../src/neoformRig.ts", import.meta.url), "utf8");
  const world = await readFile(new URL("../src/neoformWorld.ts", import.meta.url), "utf8");

  assert.match(rig, /const head = \(progress - 0\.06\) \* travel/);
  assert.match(rig, /Math\.abs\(route - head\)/);
  assert.match(rig, /TIP_INDICES\.forEach/);
  assert.match(world, /float dissolve = 1\.0 - smoothstep\(1\.08, 1\.68, progress\)/);
  assert.match(world, /center\.y \+= ring \* dissolve/);
});
