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
  assert.ok(aspects[0] < 1.05, `latent state should read as an upright sprout; got ${aspects[0].toFixed(2)}`);
  assert.ok(aspects[1] > 1.7, `inference should unfold into a manta; got ${aspects[1].toFixed(2)}`);
  assert.ok(
    aspects[2] > 1.3 && aspects[2] < 1.65,
    `emergence should contract into an eye; got ${aspects[2].toFixed(2)}`,
  );
  assert.ok(aspects[3] > 2.15, `open state should expand into Saturn's rings; got ${aspects[3].toFixed(2)}`);
  geometry.dispose();
});

test("the first state is a seed with a stem and leaf", () => {
  const geometry = createMorphGeometry(true);
  const seed = geometry.getAttribute("position") as BufferAttribute;
  const along = geometry.getAttribute("aAlong") as BufferAttribute;
  const strands = geometry.getAttribute("aStrand") as BufferAttribute;
  const seedTop = routeEndpoint(seed, along, strands, 0, 0);
  const stemBottom = routeEndpoint(seed, along, strands, 0.5, 0);
  const stemTop = routeEndpoint(seed, along, strands, 0.5, 1);
  const leafStart = routeEndpoint(seed, along, strands, 1, 0);
  const leafEnd = routeEndpoint(seed, along, strands, 1, 1);

  assert.ok(seedTop.y > 0.25 && Math.abs(seedTop.x) < 0.05);
  assert.ok(stemBottom.y < 0.02 && stemTop.y > 0.98);
  assert.ok(Math.abs(leafStart.x - leafEnd.x) < 0.02);
  assert.ok(Math.abs(leafStart.y - leafEnd.y) < 0.02);
  assert.ok(leafStart.y > 0.7);
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

test("the manta wing ribbons join into one continuous membrane", () => {
  const geometry = createMorphGeometry(true);
  const manta = geometry.getAttribute("aTarget1") as BufferAttribute;
  const along = geometry.getAttribute("aAlong") as BufferAttribute;
  const strands = geometry.getAttribute("aStrand") as BufferAttribute;
  const leftRoot = routeEndpoint(manta, along, strands, 0, 0);
  const rightRoot = routeEndpoint(manta, along, strands, 0.5, 0);
  const leftTip = routeEndpoint(manta, along, strands, 0, 0.5);
  const rightTip = routeEndpoint(manta, along, strands, 0.5, 0.5);

  assert.ok(Math.abs(leftRoot.x - rightRoot.x) < 0.02);
  assert.ok(Math.abs(leftRoot.y - rightRoot.y) < 0.02);
  assert.ok(leftTip.x < -1.5 && rightTip.x > 1.5);
  geometry.dispose();
});

test("the third state is an eye with closed iris geometry", () => {
  const geometry = createMorphGeometry(true);
  const eye = geometry.getAttribute("aTarget2") as BufferAttribute;
  const along = geometry.getAttribute("aAlong") as BufferAttribute;
  const strands = geometry.getAttribute("aStrand") as BufferAttribute;
  const leftUpper = routeEndpoint(eye, along, strands, 0, 0);
  const rightUpper = routeEndpoint(eye, along, strands, 0, 1);
  const upperCenter = routeEndpoint(eye, along, strands, 0, 0.5);
  const lowerCenter = routeEndpoint(eye, along, strands, 0.5, 0.5);
  const irisStart = routeEndpoint(eye, along, strands, 1, 0);
  const irisEnd = routeEndpoint(eye, along, strands, 1, 1);

  assert.ok(leftUpper.x < -1 && rightUpper.x > 1);
  assert.ok(upperCenter.y > 0.55 && lowerCenter.y < -0.55);
  assert.ok(Math.abs(irisStart.x - irisEnd.x) < 0.02);
  assert.ok(Math.abs(irisStart.y - irisEnd.y) < 0.02);
  geometry.dispose();
});

test("the final state is Saturn with a planet and two closed rings", () => {
  const geometry = createMorphGeometry(true);
  const saturn = geometry.getAttribute("aTarget3") as BufferAttribute;
  const along = geometry.getAttribute("aAlong") as BufferAttribute;
  const strands = geometry.getAttribute("aStrand") as BufferAttribute;
  const planetStart = routeEndpoint(saturn, along, strands, 0, 0);
  const planetEnd = routeEndpoint(saturn, along, strands, 0, 1);
  const outerLeft = routeEndpoint(saturn, along, strands, 0.5, 0.5);
  const outerRight = routeEndpoint(saturn, along, strands, 0.5, 0);
  const innerLeft = routeEndpoint(saturn, along, strands, 1, 0.5);

  assert.ok(Math.abs(planetStart.x - planetEnd.x) < 0.02);
  assert.ok(Math.abs(planetStart.y - planetEnd.y) < 0.02);
  assert.ok(outerLeft.x < -1.5 && outerRight.x > 1.5);
  assert.ok(innerLeft.x < -1.3);
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
