import assert from "node:assert/strict";
import test from "node:test";
import type { BufferAttribute } from "three";
import { createMorphGeometry } from "../src/morphGeometry.ts";

function aspectRatio(attribute: BufferAttribute) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < attribute.count; index += 1) {
    minX = Math.min(minX, attribute.getX(index));
    maxX = Math.max(maxX, attribute.getX(index));
    minY = Math.min(minY, attribute.getY(index));
    maxY = Math.max(maxY, attribute.getY(index));
  }
  return (maxX - minX) / Math.max(maxY - minY, 0.0001);
}

test("morph targets have genuinely different silhouettes", () => {
  const geometry = createMorphGeometry(true);
  const targets = [
    geometry.getAttribute("position"),
    geometry.getAttribute("aTarget1"),
    geometry.getAttribute("aTarget2"),
    geometry.getAttribute("aTarget3"),
  ] as BufferAttribute[];
  const aspects = targets.map(aspectRatio);
  assert.ok(
    Math.max(...aspects) - Math.min(...aspects) > 0.75,
    `expected major silhouette change; aspect ratios were ${aspects.map((value) => value.toFixed(2)).join(", ")}`,
  );
  assert.ok(aspects[0] < 1.1, `latent state should remain compressed; got ${aspects[0].toFixed(2)}`);
  assert.ok(aspects[1] > 1.15, `inference should form a directional route; got ${aspects[1].toFixed(2)}`);
  assert.ok(aspects[2] < 1, `emergence should branch vertically; got ${aspects[2].toFixed(2)}`);
  assert.ok(aspects[3] > 1.65, `open state should expand horizontally; got ${aspects[3].toFixed(2)}`);
  geometry.dispose();
});
