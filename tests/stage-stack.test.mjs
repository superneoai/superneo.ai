import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stateNames = ["full", "medium", "fault-low"];

function ruleBody(styles, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
}

test("completed stage words remain clean outline layers", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

  for (const depth of [-1, -2]) {
    const previousLayer = ruleBody(styles, `.stage-stack h2[data-depth="${depth}"]`);
    assert.match(previousLayer, /-webkit-text-stroke/);
    assert.doesNotMatch(previousLayer, /clip-path|opacity:\s*0\s*;/);
  }
  assert.equal(ruleBody(styles, '.stage-stack h2[data-depth="-3"]'), "");
});

test("pending stage words do not consume compositor layers", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const heading = ruleBody(styles, ".stage-stack h2");
  const pending = ruleBody(styles, '.stage-stack h2[data-state="pending"]');
  const word = ruleBody(styles, ".stage-stack .stage-word");
  const echoes = ruleBody(styles, ".stage-trail");

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
  assert.equal(ruleBody(styles, '.stage-stack h2[data-order="3"]'), "");
});

test("stage headings leave a visible compositor-only text trail", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const trailRules = [
    ruleBody(styles, '.stage-stack h2[data-state="active"] .stage-trail--near'),
    ruleBody(styles, '.stage-stack h2[data-state="active"] .stage-trail--far'),
  ].join("\n");
  const echoLayer = ruleBody(styles, ".stage-trail");
  const wordRule = ruleBody(styles, '.stage-stack h2[data-state="active"] .stage-word');

  assert.match(app, /stackRef\.current\.dataset\.direction = stage > previous/);
  assert.match(app, /window\.addEventListener\(STAGE_CHANGE_EVENT, syncStage\)/);
  assert.match(app, /aria-label=\{item\.title\}/);
  assert.match(app, /className="stage-trail stage-trail--near"/);
  assert.match(app, /className="stage-trail stage-trail--far"/);
  assert.match(
    app,
    /<StageWord title=\{item\.title\} forcedNeoState=\{forcedNeoState\} \/>/,
  );
  assert.match(app, /className="stage-word"/);
  assert.match(app, /className="stage-outline"/);
  assert.match(styles, /@keyframes stage-trail-near/);
  assert.match(styles, /@keyframes stage-trail-far/);
  assert.doesNotMatch(styles, /@keyframes stage-word-settle/);
  assert.match(trailRules, /animation:/);
  assert.doesNotMatch(trailRules, /filter|text-shadow|transition/);
  assert.match(echoLayer, /z-index:\s*0/);
  assert.doesNotMatch(styles, /\.stage-stack h2::(?:before|after)\s*\{[^}]*clip-path/s);
  assert.match(app, /const stageProgress = toStageProgress\(progress, index\)/);
  assert.match(app, /word\.style\.transform = `translate3d/);
  assert.match(app, /word\.style\.opacity = reducedMotion\.matches/);
  assert.match(wordRule, /will-change:\s*opacity, transform/);
  assert.doesNotMatch(wordRule, /animation|filter|text-shadow|transition/);
  assert.doesNotMatch(ruleBody(styles, ".stage-line"), /animation/);
  const reducedMotion = styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reducedMotion, /\.stage-trail,[\s\S]*\.stage-word,[\s\S]*animation:\s*none/);
  assert.match(
    reducedMotion,
    /\.stage-stack \.stage-word\s*\{[^}]*opacity:\s*1 !important;[^}]*transform:\s*translate3d\(0, 0, 0\) !important/s,
  );
});

test("the stage entrance releases its reveal clip after finishing", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const panel = ruleBody(
    styles,
    '.experience[data-scene-ready="true"] > .stage-panel',
  );

  assert.match(panel, /animation:\s*stage-enter\s+700ms/);
  assert.doesNotMatch(panel, /\b(?:both|forwards)\b/);
});

test("NEO neon switches pre-baked states without runtime glow paint", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const neo = ruleBody(styles, ".stage-stack .neo-accent");
  const faultStart = styles.indexOf("@keyframes neo-state-full");
  const faultEnd = styles.indexOf("@keyframes status-pulse", faultStart);
  const fault = styles.slice(faultStart, faultEnd);

  assert.match(neo, /color:\s*var\(--signal\)/);
  assert.match(neo, /text-shadow:\s*none/);
  assert.match(styles, /\.stage-word \.neo-sign--full\s*\{[^}]*animation:\s*neo-state-full\s+5\.8s/s);
  assert.match(styles, /\.stage-word \.neo-sign--medium\s*\{[^}]*animation:\s*neo-state-medium\s+5\.8s/s);
  assert.match(styles, /\.stage-word \.neo-sign--fault-low\s*\{[^}]*animation:\s*neo-state-fault-low\s+5\.8s/s);
  assert.match(ruleBody(styles, ".neo-sign"), /will-change:\s*opacity/);
  assert.doesNotMatch(neo, /\bwhite\b|saturate\(/);
  assert.match(fault, /opacity:/);
  assert.doesNotMatch(fault, /text-shadow|filter|color:/);
  assert.doesNotMatch(styles, /@keyframes\s+gecko-neon-aura/);
  assert.match(
    styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)")),
    /\.neo-sign,[\s\S]*animation:\s*none/,
  );
});

test("all engines use the same predecoded NEO halo", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const sourceRule = ruleBody(styles, ".neo-source");
  const signRule = ruleBody(styles, ".neo-sign");
  const readySourceRule = ruleBody(
    styles,
    '.stage-stack[data-sign-ready="true"] .neo-source',
  );
  const rendererStart = styles.indexOf(".stage-stack .neo-accent");
  const neoRenderer = styles.slice(rendererStart, styles.indexOf(".stage-line", rendererStart));

  assert.match(app, /className="neo-source"[^>]*>NEO<\/span>/);
  assert.match(app, /neo-sign neo-sign--full/);
  assert.match(app, /neo-sign neo-sign--medium/);
  assert.match(app, /neo-sign neo-sign--fault-low/);
  assert.match(app, /new URL\("neo-sign-full\.png"/);
  assert.match(app, /new URL\("neo-sign-medium\.png"/);
  assert.match(app, /new URL\("neo-sign-fault-low\.png"/);
  assert.match(app, /width="1000"/);
  assert.match(app, /height="640"/);
  assert.match(app, /decoding="async"/);
  assert.match(app, /loading="eager"/);
  assert.match(app, /fetchPriority="high"/);
  assert.match(app, /Promise\.all\(signs\.map/);
  assert.match(app, /sign\.decode\(\)/);
  assert.match(app, /Promise\.all\(\[imagesReady, fontReady\]\)/);
  assert.match(app, /document\.fonts\.load/);
  assert.match(app, /document\.fonts\.ready/);
  assert.match(app, /540 1em \"Geist Variable\"/);
  assert.match(app, /dataset\.signReady = "true"/);
  assert.doesNotMatch(app, /data-text="NEO"|className="neo-core"/);
  assert.match(sourceRule, /position:\s*absolute/);
  assert.match(signRule, /display:\s*block/);
  assert.match(signRule, /opacity:\s*0/);
  assert.match(signRule, /top:\s*50%/);
  assert.match(signRule, /left:\s*calc\(50% \+ 0\.051em\)/);
  assert.match(signRule, /width:\s*3\.216em/);
  assert.match(signRule, /transform:\s*translate\(-50%,\s*-50%\)/);
  assert.match(readySourceRule, /visibility:\s*hidden/);
  assert.match(ruleBody(styles, ".stage-stack .neo-accent"), /width:\s*2\.069em/);
  assert.doesNotMatch(styles, /@supports \(-moz-appearance:\s*none\)/);
  assert.doesNotMatch(
    neoRenderer,
    /radial-gradient|background-clip|text-fill-color|\.neo-accent::|\.neo-core|\bfilter\s*:/,
  );
});

test("the shared NEO files are deterministic PNG assets", async () => {
  const hashes = new Set();
  for (const state of stateNames) {
    const png = await readFile(new URL(`../public/neo-sign-${state}.png`, import.meta.url));
    assert.equal(png.toString("ascii", 1, 4), "PNG");
    assert.equal(png.readUInt32BE(16), 1000);
    assert.equal(png.readUInt32BE(20), 640);
    hashes.add(createHash("sha256").update(png).digest("hex"));
  }
  assert.equal(hashes.size, 3);
});
