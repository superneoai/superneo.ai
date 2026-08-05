import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the top-center making label remains immediately readable", async () => {
  const styles = await readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  const rule = styles.match(/\.making-line \{([\s\S]*?)\n\}/);
  assert.ok(rule, "expected the making-line style");

  const minimumSize = Number(
    rule[1].match(/font-size: clamp\(([\d.]+)rem/)?.[1],
  );
  assert.ok(minimumSize >= 0.9, `minimum label size ${minimumSize}rem is too small`);
  assert.match(rule[1], /color: var\(--bone\)/);
  assert.doesNotMatch(rule[1], /background:|border:|backdrop-filter:/);
  assert.match(styles, /\.making-line::before,\s*\.making-line::after/);
});
