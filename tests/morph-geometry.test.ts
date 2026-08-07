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
  assert.ok(aspects[0] < 0.9, `latent state should read as an upright energy core; got ${aspects[0].toFixed(2)}`);
  assert.ok(aspects[1] > 1.3, `inference should unfold into a Mobius field; got ${aspects[1].toFixed(2)}`);
  assert.ok(
    aspects[2] > 0.95 && aspects[2] < 1.25,
    `emergence should contract into a gyroscopic cage; got ${aspects[2].toFixed(2)}`,
  );
  assert.ok(aspects[3] > 1.8, `open state should expand into a hex gate; got ${aspects[3].toFixed(2)}`);
  geometry.dispose();
});

test("the first state is a nested faceted energy core", () => {
  const geometry = createMorphGeometry(true);
  const core = geometry.getAttribute("position") as BufferAttribute;
  const along = geometry.getAttribute("aAlong") as BufferAttribute;
  const strands = geometry.getAttribute("aStrand") as BufferAttribute;
  const outerStart = routeEndpoint(core, along, strands, 0, 0);
  const outerEnd = routeEndpoint(core, along, strands, 0, 1);
  const innerStart = routeEndpoint(core, along, strands, 0.5, 0);
  const innerEnd = routeEndpoint(core, along, strands, 0.5, 1);
  const axisTop = routeEndpoint(core, along, strands, 1, 0);
  const axisBottom = routeEndpoint(core, along, strands, 1, 1);

  assert.ok(Math.abs(outerStart.x - outerEnd.x) < 0.02);
  assert.ok(Math.abs(outerStart.y - outerEnd.y) < 0.02);
  assert.ok(Math.abs(innerStart.x - innerEnd.x) < 0.02);
  assert.ok(Math.abs(innerStart.y - innerEnd.y) < 0.02);
  assert.ok(axisTop.y > 1 && axisBottom.y < -1);
  geometry.dispose();
});

test("the second state is a closed three-band Mobius field", () => {
  const geometry = createMorphGeometry(true);
  const mobius = geometry.getAttribute("aTarget1") as BufferAttribute;
  const along = geometry.getAttribute("aAlong") as BufferAttribute;
  const strands = geometry.getAttribute("aStrand") as BufferAttribute;
  const fieldBounds = bounds(mobius);

  for (const strand of [0, 0.5, 1]) {
    const start = routeEndpoint(mobius, along, strands, strand, 0);
    const end = routeEndpoint(mobius, along, strands, strand, 1);
    assert.ok(Math.abs(start.x - end.x) < 0.02);
    assert.ok(Math.abs(start.y - end.y) < 0.02);
  }
  assert.ok(fieldBounds.maxX - fieldBounds.minX > 1.8);
  geometry.dispose();
});

test("the third state is a closed three-axis gyroscopic cage", () => {
  const geometry = createMorphGeometry(true);
  const cage = geometry.getAttribute("aTarget2") as BufferAttribute;
  const along = geometry.getAttribute("aAlong") as BufferAttribute;
  const strands = geometry.getAttribute("aStrand") as BufferAttribute;

  for (const strand of [0, 0.5, 1]) {
    const start = routeEndpoint(cage, along, strands, strand, 0);
    const end = routeEndpoint(cage, along, strands, strand, 1);
    assert.ok(Math.abs(start.x - end.x) < 0.02);
    assert.ok(Math.abs(start.y - end.y) < 0.02);
  }
  const cageBounds = bounds(cage);
  assert.ok(cageBounds.maxX > 1 && cageBounds.minX < -1);
  assert.ok(cageBounds.maxY > 0.9 && cageBounds.minY < -0.9);
  geometry.dispose();
});

test("the final state is a concentric hex gate with an energy slit", () => {
  const geometry = createMorphGeometry(true);
  const gate = geometry.getAttribute("aTarget3") as BufferAttribute;
  const along = geometry.getAttribute("aAlong") as BufferAttribute;
  const strands = geometry.getAttribute("aStrand") as BufferAttribute;
  const outerStart = routeEndpoint(gate, along, strands, 0, 0);
  const outerEnd = routeEndpoint(gate, along, strands, 0, 1);
  const innerStart = routeEndpoint(gate, along, strands, 0.5, 0);
  const innerEnd = routeEndpoint(gate, along, strands, 0.5, 1);
  const slitLeft = routeEndpoint(gate, along, strands, 1, 0);
  const slitRight = routeEndpoint(gate, along, strands, 1, 1);

  assert.ok(Math.abs(outerStart.x - outerEnd.x) < 0.02);
  assert.ok(Math.abs(outerStart.y - outerEnd.y) < 0.02);
  assert.ok(Math.abs(innerStart.x - innerEnd.x) < 0.02);
  assert.ok(Math.abs(innerStart.y - innerEnd.y) < 0.02);
  assert.ok(slitLeft.x < -1.95 && slitRight.x > 1.95);
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
