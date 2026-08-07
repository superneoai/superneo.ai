import assert from "node:assert/strict";
import test from "node:test";
import type { BufferAttribute } from "three";
import { createMorphGeometry, createPointGeometry } from "../src/morphGeometry.ts";

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

function bounds(attribute: BufferAttribute) {
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
  return { minX, maxX, minY, maxY };
}

function routeEndpoint(
  target: BufferAttribute,
  along: BufferAttribute,
  strands: BufferAttribute,
  strand: number,
  endpoint: number,
) {
  let count = 0;
  const point = { x: 0, y: 0 };
  for (let index = 0; index < target.count; index += 1) {
    if (
      Math.abs(strands.getX(index) - strand) < 0.001 &&
      Math.abs(along.getX(index) - endpoint) < 0.001
    ) {
      point.x += target.getX(index);
      point.y += target.getY(index);
      count += 1;
    }
  }
  return { x: point.x / count, y: point.y / count };
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
  assert.ok(aspects[1] > 1.7, `inference should unfold into a manta; got ${aspects[1].toFixed(2)}`);
  assert.ok(
    aspects[2] > 0.95 && aspects[2] < 1.35,
    `emergence should contract around an iris; got ${aspects[2].toFixed(2)}`,
  );
  assert.ok(aspects[3] > 1.75, `open state should expand into a gateway; got ${aspects[3].toFixed(2)}`);
  geometry.dispose();
});

test("the manta keeps a recognizable wing span and nose-tail axis", () => {
  const geometry = createMorphGeometry(true);
  const manta = geometry.getAttribute("aTarget1") as BufferAttribute;
  const along = geometry.getAttribute("aAlong") as BufferAttribute;
  const strands = geometry.getAttribute("aStrand") as BufferAttribute;
  const mantaBounds = bounds(manta);
  const nose = routeEndpoint(manta, along, strands, 1, 0);
  const tail = routeEndpoint(manta, along, strands, 1, 1);

  assert.ok(mantaBounds.maxX - mantaBounds.minX > 3);
  assert.ok(Math.abs(nose.x) < 0.1 && nose.y > 0.48);
  assert.ok(Math.abs(tail.x) < 0.1 && tail.y < -0.95);
  geometry.dispose();
});

test("point rendering visits each unique vertex once and preserves indexed brightness", () => {
  const geometry = createMorphGeometry(false);
  const points = createPointGeometry(geometry);
  const weights = points.getAttribute("aPointWeight") as BufferAttribute;
  let weightTotal = 0;
  for (let index = 0; index < weights.count; index += 1) {
    weightTotal += weights.getX(index);
  }

  assert.equal(points.getIndex(), null);
  assert.equal(points.getAttribute("position").count, geometry.getAttribute("position").count);
  assert.equal(weightTotal, geometry.getIndex()?.count);
  points.dispose();
  geometry.dispose();
});
