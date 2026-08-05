import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const captureNumber = (source, pattern, label) => {
  const match = source.match(pattern);
  assert.ok(match, `expected ${label} in the background shader`);
  return Number(match[1]);
};

test("the actual background image has perceptible idle motion", async () => {
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );
  const imageSection = shader.match(
    /float imageZoom[\s\S]*?vec3 surface = mix\(clean, layerA,[\s\S]*?;/,
  );
  assert.ok(imageSection, "expected the animated image sampling section");

  const panRate = captureNumber(
    imageSection[0],
    /vec2 imagePan = vec2\(\s*sin\(uTime \* ([\d.]+)/,
    "image pan rate",
  );
  const parallaxAmount = captureNumber(
    imageSection[0],
    /\) \* (0\.\d+);\s*vec3 clean/,
    "layer parallax amount",
  );

  assert.ok(panRate >= 0.15, `image pan rate ${panRate} is too slow to perceive`);
  assert.ok(
    parallaxAmount >= 0.006,
    `image parallax ${parallaxAmount} is too weak to perceive`,
  );
  assert.match(
    shader,
    /clamp\(idleWeight \* 0\.1[2-9] \+ uPointerMotion/,
    "the counter-layer should remain visible while idle",
  );
});
