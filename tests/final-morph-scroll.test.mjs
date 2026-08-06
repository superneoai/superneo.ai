import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the final morph follows scroll without a second smoothing delay", async () => {
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );

  assert.match(field, /scrub: true/);
  assert.doesNotMatch(field, /scrub:\s*reducedMotion\.matches\s*\?\s*false\s*:\s*[\d.]+/);
});
