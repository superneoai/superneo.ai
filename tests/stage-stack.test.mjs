import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function ruleBody(styles, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
}

test("completed stage words remain clean outline layers", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

  for (const depth of [-1, -2, -3]) {
    const previousLayer = ruleBody(styles, `.stage-stack h2[data-depth="${depth}"]`);
    assert.match(previousLayer, /-webkit-text-stroke/);
    assert.doesNotMatch(previousLayer, /clip-path|opacity:\s*0\s*;/);
  }
  assert.match(ruleBody(styles, '.stage-stack h2[data-state="pending"]'), /opacity:\s*0/);
});

test("stage words cascade from top-left to bottom-right", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(app, /data-order=\{index\}/);
  assert.match(ruleBody(styles, ".stage-stack h2"), /top:\s*0/);
  assert.match(ruleBody(styles, '.stage-stack h2[data-order="0"]'), /--stack-x:\s*0em/);
  assert.match(ruleBody(styles, '.stage-stack h2[data-order="1"]'), /--stack-x:\s*0\.3em/);
  assert.match(ruleBody(styles, '.stage-stack h2[data-order="2"]'), /--stack-y:\s*0\.58em/);
  assert.match(ruleBody(styles, '.stage-stack h2[data-order="3"]'), /--stack-y:\s*0\.87em/);
});

test("NEO neon preserves the shared accent hue", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const neo = ruleBody(styles, ".stage-stack .neo-accent");
  const neonAnimation = styles.slice(
    styles.indexOf("@keyframes neo-neon-fault"),
    styles.indexOf("@media (max-width: 720px)"),
  );

  assert.match(neo, /color:\s*var\(--signal\)/);
  assert.doesNotMatch(`${neo}\n${neonAnimation}`, /\bwhite\b|saturate\(/);
});
