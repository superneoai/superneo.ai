import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the final morph follows scroll without a second smoothing delay", async () => {
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );

  assert.match(field, /const progress = Math\.min\(1, Math\.max\(0, scrollY \/ scrollRange\)\)/);
  assert.match(field, /window\.addEventListener\("scroll", scheduleScrollProgress/);
  assert.doesNotMatch(field, /ScrollTrigger|scrub:/);
});
