import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const captureNumber = (source, pattern, label) => {
  const match = source.match(pattern);
  assert.ok(match, `expected ${label} in the shader source`);
  return Number(match[1]);
};

test("the blue phase survives the surface and particle composites", async () => {
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );
  const surfacePresence = captureNumber(
    shader,
    /float spectralPresence = ([\d.]+) \+ rim/,
    "surface spectral presence",
  );
  const particlePresence = captureNumber(
    shader,
    /spectral,\s*([\d.]+) \+ vSeed \* [\d.]+/,
    "particle spectral presence",
  );

  assert.ok(
    surfacePresence >= 0.24,
    `surface color contribution ${surfacePresence} is too weak to make blue visible`,
  );
  assert.ok(
    particlePresence >= 0.3,
    `particle color contribution ${particlePresence} is too weak to make blue visible`,
  );
});

test("the spectral loop continuously visits a broad cool-neon palette", async () => {
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );

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
