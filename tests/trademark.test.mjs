import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the canonical brand uses one intentional trademark treatment", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const privacy = await readFile(
    new URL("../public/privacy/index.html", import.meta.url),
    "utf8",
  );
  const legal = await readFile(
    new URL("../public/legal/index.html", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );

  assert.match(app, /aria-label="superneo\.ai">superneo\.ai<\/h1>/);
  assert.doesNotMatch(app, /brand-tm brand-tm--domain/);
  assert.match(app, /brand-tm brand-tm--stage/);
  assert.match(app, /showTrademark/);
  assert.match(app, /<StageWord[\s\S]*showTrademark[\s\S]*\/>/);
  assert.match(app, /aria-label=\{item\.title\}/);
  assert.match(styles, /\.superneo-word\s*{[^}]*padding-right:\s*0\.25em/s);
  assert.match(styles, /\.brand-tm--stage\s*{[^}]*position:\s*absolute/s);
  for (const page of [privacy, legal]) {
    assert.match(page, /SUPERNEO<sup aria-hidden="true">™<\/sup>/);
    assert.equal((page.match(/™/g) ?? []).length, 1);
  }
  assert.doesNotMatch(`${app}\n${html}\n${privacy}\n${legal}`, /®/);
  assert.doesNotMatch(
    `${app}\n${html}\n${privacy}\n${legal}`,
    /\bSuperneo\b|SuperNeo|Super Neo/,
  );
  assert.match(html, /"name": "SUPERNEO"/);
});
