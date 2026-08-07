import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the assembled rig uses one continuous canonical pose", async () => {
  const rig = await readFile(
    new URL("../src/neoformRig.ts", import.meta.url),
    "utf8",
  );

  assert.match(rig, /sampleBiped\(input, scratch\.biped/);
  assert.match(rig, /sampleQuadruped\(input, scratch\.quadruped/);
  assert.match(rig, /const formBlend = smoothstep\(0, 1, input\.formBlend\)/);
  assert.match(rig, /formBlend <= 0\.002/);
  assert.match(rig, /formBlend >= 0\.998/);
  assert.match(rig, /scratch\.biped\[index\],[\s\S]*scratch\.quadruped\[index\]/);
});

test("reduced motion freezes locomotion, echoes, and swarm orbit", async () => {
  const rig = await readFile(
    new URL("../src/neoformRig.ts", import.meta.url),
    "utf8",
  );
  const world = await readFile(
    new URL("../src/neoformWorld.ts", import.meta.url),
    "utf8",
  );
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );

  assert.match(rig, /input\.reducedMotion \? 0\.8 : input\.time/);
  assert.match(rig, /input\.reducedMotion \? 0 : input\.leap/);
  assert.match(rig, /predictionsVisible = input\.predictionStrength > 0\.02 && !input\.reducedMotion/);
  assert.match(world, /activeTime = uTime \* \(1\.0 - uReducedMotion\)/);
  assert.match(field, /motionIsReduced\(\) && sceneReady && !needsRender/);
});

test("the isometric chase framing cannot turn the actor edge-on", async () => {
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );

  assert.match(field, /objectGroup\.rotation\.y = -0\.52 \+ Math\.sin\(time \* 0\.11\) \* 0\.035/);
  assert.doesNotMatch(field, /ambientTurn|time \* 0\.045/);
});
