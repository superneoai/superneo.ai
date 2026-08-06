import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("all screens use native scrolling without an inertial catch-up tail", async () => {
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );
  const manifest = await readFile(new URL("../package.json", import.meta.url), "utf8");

  assert.doesNotMatch(field, /Lenis|smoothWheel|wheelMultiplier/);
  assert.doesNotMatch(manifest, /"lenis"/);
});
