import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile browser chrome cannot resize and reframe the fixed scene while scrolling", async () => {
  const field = await readFile(
    new URL("../src/LatentField.tsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  const resizeBody = field.match(/const resize = \(\) => \{([\s\S]*?)\n    \};/)?.[1] ?? "";

  assert.match(styles, /\.signal-stage,[\s\S]*?height:\s*100lvh/);
  assert.match(resizeBody, /host\.clientWidth/);
  assert.match(resizeBody, /host\.clientHeight/);
  assert.match(resizeBody, /if \(!sizeChanged && !profileChanged\) return/);
  assert.doesNotMatch(resizeBody, /window\.innerHeight/);
  assert.doesNotMatch(field, /visualViewport\?\.addEventListener\("resize"/);
});
