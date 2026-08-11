import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the final morph follows scroll without a second smoothing delay", async () => {
  const progress = await readFile(
    new URL("../src/sceneProgress.ts", import.meta.url),
    "utf8",
  );

  assert.match(progress, /const progress = Math\.min\(1, Math\.max\(0, scrollY \/ scrollRange\)\)/);
  assert.match(progress, /window\.addEventListener\("scroll", schedule/);
  assert.doesNotMatch(progress, /ScrollTrigger|scrub:/);
});
