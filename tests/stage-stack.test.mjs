import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
});

test("pending stage words do not consume compositor layers", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const heading = ruleBody(styles, ".stage-stack h2");
  const pending = ruleBody(styles, '.stage-stack h2[data-state="pending"]');
  const word = ruleBody(styles, ".stage-stack .stage-word");
  const echoes = styles.match(
    /\.stage-stack h2::before,\s*\.stage-stack h2::after\s*\{([^}]*)\}/s,
  )?.[1] ?? "";

  assert.doesNotMatch(heading, /will-change/);
  assert.doesNotMatch(word, /will-change/);
  assert.doesNotMatch(echoes, /will-change/);
  assert.match(pending, /opacity:\s*0/);
  assert.doesNotMatch(pending, /display:\s*none|visibility:\s*hidden/);
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

test("stage headings leave a visible compositor-only text trail", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const trailRules = [
    ruleBody(styles, '.stage-stack h2[data-state="active"]::before'),
    ruleBody(styles, '.stage-stack h2[data-state="active"]::after'),
  ].join("\n");
  const echoLayer = styles.match(
    /\.stage-stack h2::before,\s*\.stage-stack h2::after\s*\{([^}]*)\}/s,
  )?.[1] ?? "";
  const wordRule = ruleBody(styles, '.stage-stack h2[data-state="active"] .stage-word');

  assert.match(app, /stackRef\.current\.dataset\.direction = stage > previous/);
  assert.match(app, /window\.addEventListener\(STAGE_CHANGE_EVENT, syncStage\)/);
  assert.match(app, /data-label=\{item\.title\}/);
  assert.match(app, /aria-label=\{item\.title\}/);
  assert.match(app, /className="stage-word"/);
  assert.match(app, /className="stage-outline"/);
  assert.match(styles, /@keyframes stage-trail-near/);
  assert.match(styles, /@keyframes stage-trail-far/);
  assert.match(styles, /@keyframes stage-word-settle/);
  assert.match(styles, /@keyframes gecko-stage-trail-near/);
  assert.match(styles, /@keyframes gecko-stage-trail-far/);
  assert.match(trailRules, /animation:/);
  assert.doesNotMatch(trailRules, /filter|text-shadow|transition/);
  assert.match(echoLayer, /z-index:\s*0/);
  assert.doesNotMatch(styles, /\.stage-stack h2::(?:before|after)\s*\{[^}]*clip-path/s);
  assert.match(wordRule, /animation:\s*stage-word-settle/);
  assert.doesNotMatch(wordRule, /filter|text-shadow|transition/);
  assert.doesNotMatch(ruleBody(styles, ".stage-line"), /animation/);
  assert.match(
    styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)")),
    /\.stage-stack h2::before,[\s\S]*\.stage-stack h2::after,[\s\S]*\.stage-word,[\s\S]*animation:\s*none/,
  );
});

test("the stage entrance releases its reveal clip after finishing", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const panel = ruleBody(styles, ".stage-panel");

  assert.match(panel, /animation:\s*stage-enter\s+700ms/);
  assert.doesNotMatch(panel, /\b(?:both|forwards)\b/);
});

test("NEO neon flickers through opacity without runtime glow paint", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const neo = ruleBody(styles, ".stage-stack .neo-accent");
  const activeNeo = ruleBody(styles, '.stage-stack h2[data-state="active"] .neo-accent');
  const faultStart = styles.indexOf("@keyframes neo-neon-fault");
  const faultEnd = styles.indexOf("@keyframes status-pulse", faultStart);
  const fault = styles.slice(faultStart, faultEnd);

  assert.match(neo, /color:\s*var\(--signal\)/);
  assert.match(neo, /text-shadow:\s*none/);
  assert.match(neo, /animation:\s*none/);
  assert.match(activeNeo, /animation:\s*neo-neon-fault\s+5\.8s\s+steps\(1,\s*end\)\s+infinite/);
  assert.match(neo, /will-change:\s*opacity/);
  assert.doesNotMatch(neo, /\bwhite\b|saturate\(/);
  assert.match(fault, /opacity:/);
  assert.doesNotMatch(fault, /text-shadow|filter|color:/);
  assert.doesNotMatch(styles, /@keyframes\s+gecko-neon-aura/);
  assert.match(
    styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)")),
    /\.stage-stack \.neo-accent,[\s\S]*animation:\s*none/,
  );
});

test("all engines use the same predecoded NEO halo", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = styles.indexOf("@supports (-moz-appearance: none)");

  assert.notEqual(start, -1);
  const geckoFallback = styles.slice(start, styles.indexOf("@media (max-width: 720px)", start));
  const sourceRule = ruleBody(styles, ".neo-source");
  const signRule = ruleBody(styles, ".neo-sign");
  const readySourceRule = ruleBody(
    styles,
    '.neo-accent[data-sign-ready="true"] .neo-source',
  );
  const readySignRule = ruleBody(
    styles,
    '.neo-accent[data-sign-ready="true"] .neo-sign',
  );
  const rendererStart = styles.indexOf(".stage-stack .neo-accent");
  const neoRenderer = styles.slice(rendererStart, styles.indexOf(".stage-line", rendererStart));
  const headingRule = ruleBody(geckoFallback, ".stage-stack h2");
  const outlineRule = ruleBody(geckoFallback, ".stage-outline");
  const wordRule = ruleBody(geckoFallback, ".stage-stack .stage-word");

  assert.match(app, /className="neo-source">NEO<\/span>/);
  assert.match(app, /className="neo-sign"/);
  assert.match(app, /new URL\("neo-sign\.png\?rev=b8578999"/);
  assert.match(app, /src=\{neoSignUrl\}/);
  assert.match(app, /width="1000"/);
  assert.match(app, /height="640"/);
  assert.match(app, /decoding="async"/);
  assert.match(app, /loading="eager"/);
  assert.match(app, /fetchPriority="high"/);
  assert.match(app, /const imageReady = Promise\.race/);
  assert.match(app, /sign\.decode\(\)/);
  assert.match(app, /Promise\.all\(\[imageReady, fontReady\]\)/);
  assert.match(app, /document\.fonts\.load/);
  assert.match(app, /document\.fonts\.ready/);
  assert.match(app, /540 1em \"Geist Variable\"/);
  assert.match(app, /data-sign-ready/);
  assert.doesNotMatch(app, /data-text="NEO"|className="neo-core"/);
  assert.match(sourceRule, /visibility:\s*visible/);
  assert.match(signRule, /display:\s*block/);
  assert.match(signRule, /opacity:\s*0/);
  assert.match(signRule, /top:\s*50%/);
  assert.match(signRule, /left:\s*50%/);
  assert.match(signRule, /transform:\s*translate\(-50%,\s*-50%\)/);
  assert.match(readySourceRule, /visibility:\s*hidden/);
  assert.match(readySignRule, /opacity:\s*1/);
  assert.match(headingRule, /will-change:\s*transform/);
  assert.match(outlineRule, /opacity:\s*0\.004/);
  assert.match(outlineRule, /will-change:\s*opacity,\s*transform/);
  assert.match(wordRule, /opacity:\s*0\.004/);
  assert.match(wordRule, /will-change:\s*opacity,\s*transform/);
  assert.match(geckoFallback, /animation-name:\s*gecko-stage-trail-near/);
  assert.match(geckoFallback, /animation-name:\s*gecko-stage-trail-far/);
  assert.doesNotMatch(geckoFallback, /\.neo-(?:accent|source|sign)/);
  assert.doesNotMatch(
    neoRenderer,
    /radial-gradient|background-clip|text-fill-color|\.neo-accent::|\.neo-core|\bfilter\s*:/,
  );
});

test("the shared NEO halo keeps its deterministic artboard", async () => {
  const png = await readFile(new URL("../public/neo-sign.png", import.meta.url));

  assert.equal(png.toString("ascii", 1, 4), "PNG");
  assert.equal(png.readUInt32BE(16), 1000);
  assert.equal(png.readUInt32BE(20), 640);
  assert.equal(
    createHash("sha256").update(png).digest("hex"),
    "b8578999ada9828a095e9e1e6372ca35c30551806e1c6bd63bc3e532718f3813",
  );
});
