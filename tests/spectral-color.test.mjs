import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const captureNumber = (source, pattern, label) => {
  const match = source.match(pattern);
  assert.ok(match, `expected ${label} in the shader source`);
  return Number(match[1]);
};

const multiplyMatrix = (matrix, vector) => matrix.map((row) =>
  row.reduce((sum, value, index) => sum + value * vector[index], 0));

const acesDisplayColor = (linearColor) => {
  const input = [
    [0.59719, 0.35458, 0.04823],
    [0.076, 0.90834, 0.01566],
    [0.0284, 0.13383, 0.83777],
  ];
  const output = [
    [1.60475, -0.53108, -0.07367],
    [-0.10208, 1.10813, -0.00605],
    [-0.00327, -0.07276, 1.07602],
  ];
  const exposed = linearColor.map((value) => value * 0.75 * 1.08 / 0.6);
  const fitted = multiplyMatrix(input, exposed).map((value) => {
    const numerator = value * (value + 0.0245786) - 0.000090537;
    const denominator = value * (0.983729 * value + 0.432951) + 0.238081;
    return numerator / denominator;
  });
  return multiplyMatrix(output, fitted).map((value) => {
    const clamped = Math.min(1, Math.max(0, value));
    return clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  });
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

test("the routed tip signal preserves the shared accent through additive bloom", async () => {
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );

  const surfaceStart = shader.indexOf("export const surfaceFragmentShader");
  const particleStart = shader.indexOf("export const particleFragmentShader");
  const backgroundStart = shader.indexOf("export const backgroundVertexShader");
  const surface = shader.slice(surfaceStart, particleStart);
  const particle = shader.slice(particleStart, backgroundStart);

  assert.match(styles, /--signal:\s*#[\da-f]{6}/i);
  assert.match(field, /getPropertyValue\("--signal"\)/);
  assert.match(field, /new THREE\.Color\(signalColor\)/);
  assert.equal(
    (shader.match(/uniform vec3 uSignalColor;/g) ?? []).length,
    5,
    "every accent-bearing shader shares the same color-managed signal",
  );
  assert.doesNotMatch(shader, /routedPhosphor|vec3 phosphor =/);
  assert.match(surface, /float routedSignal = max\(vSignalPulse, vEndpointGlow\);/);
  assert.match(surface, /coverage = clamp\([\s\S]*?routedSignal \* [\d.]+/);
  for (const [label, fragment] of [["surface", surface], ["particle", particle]]) {
    assert.match(fragment, /uniform vec3 uSignalColor;/, `${label} shares the CSS accent`);
  }
  assert.match(surface, /color \+= uSignalColor \* vSignalPulse \* 0\.68;/);
  assert.match(surface, /color \+= uSignalColor \* vEndpointGlow \* 0\.36;/);
  assert.match(surface, /color \+= bone \* vEndpointGlow \* 0\.05;/);
  assert.match(particle, /color \+= uSignalColor \* vSignalPulse \* 0\.64;/);
  assert.match(particle, /color \+= uSignalColor \* vEndpointGlow \* 0\.32;/);
  assert.doesNotMatch(surface, /routedColor|mix\(color, routedColor/);
  assert.doesNotMatch(particle, /uSignalColor \* 0\.58/);
});

test("pointer activity cannot wash the whole ASCII field green", async () => {
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );
  const post = shader.slice(shader.indexOf("export const asciiDitherPostFragmentShader"));

  assert.match(post, /uInteraction \* 0\.06 \+ edge \* 0\.04/);
  assert.doesNotMatch(post, /uInteraction \* 0\.2[\d]/);
});

test("the endpoint remains legible after the routed head reaches a tip", async () => {
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );
  const surfaceSignal = shader.match(
    /vSignalPulse \* ([\d.]+) \+ vEndpointGlow \* ([\d.]+) \+/,
  );
  const pointSize = shader.match(
    /vSignalPulse \* ([\d.]+) \+ vEndpointGlow \* ([\d.]+)\) \*/,
  );
  const particleSignal = shader.match(
    /vSignalPulse \* ([\d.]+) \+ vEndpointGlow \* ([\d.]+),/,
  );

  for (const [label, match, minimumRatio] of [
    ["surface color", surfaceSignal, 0.85],
    ["point size", pointSize, 0.7],
    ["particle color", particleSignal, 0.85],
  ]) {
    assert.ok(match, `expected ${label} routed coefficients`);
    const travel = Number(match[1]);
    const endpoint = Number(match[2]);
    assert.ok(
      endpoint / travel >= minimumRatio,
      `${label} endpoint ${endpoint} is too weak beside travel ${travel}`,
    );
  }
});
