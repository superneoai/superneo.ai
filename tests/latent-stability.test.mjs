import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("layered LATENT shells share one ambient morph phase", async () => {
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );
  const morphFunction = shader.match(
    /vec3 morphPosition\(\) \{([\s\S]*?)vec3 current/,
  );

  assert.ok(morphFunction, "expected the morphPosition shader function");
  assert.doesNotMatch(
    morphFunction[1],
    /sin\([^)]*uMorphBias/,
    "per-shell morph bias must not shift the ambient animation phase and make LATENT layers fight",
  );
});

test("ambient morph layers converge at settled topology endpoints", async () => {
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );
  const morphFunction = shader.match(
    /vec3 morphPosition\(\) \{([\s\S]*?)vec3 current/,
  );

  assert.ok(morphFunction, "expected the morphPosition shader function");
  assert.match(morphFunction[1], /float basePhase = uStagePhase/);
  assert.match(morphFunction[1], /float transitionEnvelope = transitionWave \* transitionWave/);
  assert.match(morphFunction[1], /\* 4\.0 \* transitionEnvelope/);
});

test("the isometric chase framing cannot turn the actor edge-on", async () => {
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );

  assert.match(field, /objectGroup\.rotation\.y = -0\.52 \+ Math\.sin\(time \* 0\.11\) \* 0\.035/);
  assert.doesNotMatch(field, /ambientTurn|time \* 0\.045/);
});
