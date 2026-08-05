import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("layered LATENT shells share one ambient morph phase", async () => {
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );
  const morphFunction = shader.match(
    /vec3 morphPosition\(\) \{([\s\S]*?)float progress/,
  );

  assert.ok(morphFunction, "expected the morphPosition shader function");
  assert.doesNotMatch(
    morphFunction[1],
    /sin\([^)]*uMorphBias/,
    "per-shell morph bias must not shift the ambient animation phase and make LATENT layers fight",
  );
});

test("LATENT ambient motion has no hard switch near the start of scroll", async () => {
  const shader = await readFile(
    new URL("../src/latentShader.ts", import.meta.url),
    "utf8",
  );
  const morphFunction = shader.match(
    /vec3 morphPosition\(\) \{([\s\S]*?)float progress/,
  );

  assert.ok(morphFunction, "expected the morphPosition shader function");
  assert.doesNotMatch(
    morphFunction[1],
    /if \(uScroll < 0\.04\)/,
    "crossing the opening scroll boundary must not abruptly change ambient motion",
  );
});
