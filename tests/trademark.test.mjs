import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every visible SUPERNEO brand treatment carries a trademark mark", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const styles = await readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );

  assert.match(app, /aria-label="superneo\.ai, trademark"/);
  assert.match(app, /brand-tm brand-tm--domain/);
  assert.match(app, /brand-tm brand-tm--stage/);
  assert.match(app, /item\.title === "SUPERNEO" \? "SUPERNEO, trademark"/);
  assert.match(styles, /\.brand-tm--domain\s*{[^}]*font-size:\s*0\.58em/s);
  assert.match(styles, /\.superneo-word\s*{[^}]*padding-right:\s*0\.25em/s);
  assert.match(styles, /\.brand-tm--stage\s*{[^}]*position:\s*absolute/s);
});
