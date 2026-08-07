import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPACT_SWARM_COUNT,
  createBiomeInstances,
  DESKTOP_SWARM_COUNT,
} from "../src/neoformWorld.ts";

test("desktop and mobile retain the same biome with bounded density", () => {
  assert.equal(DESKTOP_SWARM_COUNT, 700);
  assert.equal(COMPACT_SWARM_COUNT, 260);
  const desktop = createBiomeInstances(DESKTOP_SWARM_COUNT);
  const compact = createBiomeInstances(COMPACT_SWARM_COUNT);
  assert.equal(desktop.length, 700);
  assert.equal(compact.length, 260);
  assert.ok(desktop.some((instance) => instance.kind < 0.56));
  assert.ok(desktop.some((instance) => instance.kind >= 0.56 && instance.kind < 0.84));
  assert.ok(desktop.some((instance) => instance.kind >= 0.84));
});

test("biome layout and swarm targets are deterministic", () => {
  const first = createBiomeInstances(64);
  const second = createBiomeInstances(64);
  assert.deepEqual(first, second);
});

test("the ground is isometric and the bloom occupies real volume", () => {
  const instances = createBiomeInstances(700);
  const groundX = instances.map((instance) => instance.ground[0]);
  const groundZ = instances.map((instance) => instance.ground[2]);
  const swarmY = instances.map((instance) => instance.swarm[1]);
  const swarmZ = instances.map((instance) => instance.swarm[2]);

  assert.ok(Math.max(...groundX) - Math.min(...groundX) > 4.9);
  assert.ok(Math.max(...groundZ) - Math.min(...groundZ) > 2.6);
  assert.ok(Math.max(...swarmY) - Math.min(...swarmY) > 1.2);
  assert.ok(Math.max(...swarmZ) - Math.min(...swarmZ) > 1.2);
});
