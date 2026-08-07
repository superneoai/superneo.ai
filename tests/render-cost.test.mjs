import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the scene preserves its original bloom without engine-specific branches", async () => {
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");
  const shader = await readFile(new URL("../src/latentShader.ts", import.meta.url), "utf8");
  const rig = await readFile(new URL("../src/neoformRig.ts", import.meta.url), "utf8");
  const world = await readFile(new URL("../src/neoformWorld.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(field, /new UnrealBloomPass\(new THREE\.Vector2\(1, 1\), 0\.24, 0\.48, 0\.38\)/);
  assert.match(field, /bloomPass\.strength = 0\.16 \+ interactionEnergy \* 0\.2 \+ signalEnergy \* 0\.04/);
  assert.match(field, /bloomPass\.radius = 0\.4 \+ interactionEnergy \* 0\.065/);
  assert.doesNotMatch(field, /uGlowStrength/);
  assert.match(rig, /InstancedMesh/);
  assert.match(rig, /DynamicDrawUsage/);
  assert.match(world, /InstancedBufferGeometry/);
  assert.match(world, /const shardVertices = new THREE\.Float32BufferAttribute/);
  assert.doesNotMatch(world, /setMatrixAt/);
  assert.match(field, /timeUniform\.value - previousRigUpdate >= 1 \/ 60/);
  assert.doesNotMatch(field, /forceSinglePass = true/);
  assert.doesNotMatch(field, /HIGH_REFRESH_THRESHOLD/);
  assert.doesNotMatch(shader, /uGlowStrength/);
  assert.match(styles, /\.signal-artwork-fallback\s*\{[^}]*display:\s*none/s);
  assert.match(styles, /\.signal-poster \.signal-artwork-fallback--desktop/);
  assert.match(styles, /\.signal-poster \.signal-artwork-fallback--mobile/);
  assert.doesNotMatch(styles, /\.signal-stage \.signal-artwork-fallback/);
});
