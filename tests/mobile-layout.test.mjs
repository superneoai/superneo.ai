import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile layout covers narrow, notched, touch, and short screens", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");

  assert.match(html, /viewport-fit=cover/);
  assert.match(styles, /@media \(max-width: 480px\)/);
  assert.match(styles, /@media \(max-height: 560px\) and \(max-width: 900px\)/);
  assert.match(styles, /env\(safe-area-inset-top/);
  assert.match(styles, /env\(safe-area-inset-bottom/);
  assert.match(styles, /min-height: 2\.75rem/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(field, /width < 720 \? 1 : 1\.35/);
  assert.match(field, /createMorphGeometry\(window\.innerWidth < 720\)/);
});
