import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function cssBlockBody(source, openingBrace) {
  let depth = 1;
  let quote = null;
  let escaped = false;

  for (let index = openingBrace + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }

  return null;
}

function cssRuleBody(source, selector) {
  let cursor = 0;
  while (cursor < source.length) {
    const openingBrace = source.indexOf("{", cursor);
    if (openingBrace === -1) return null;
    const ruleSelectors = source.slice(cursor, openingBrace)
      .split(",")
      .map((candidate) => candidate.trim());
    const body = cssBlockBody(source, openingBrace);
    if (body === null) return null;
    if (ruleSelectors.includes(selector)) return body;
    cursor = openingBrace + body.length + 2;
  }
  return null;
}

function assertReducedMotionDisablesFooterBrand(styles) {
  const mediaPrelude = "@media (prefers-reduced-motion: reduce)";
  const mediaStart = styles.indexOf(mediaPrelude);
  assert.notEqual(mediaStart, -1, "expected the reduced-motion media query");
  const mediaOpeningBrace = styles.indexOf("{", mediaStart + mediaPrelude.length);
  const mediaBody = cssBlockBody(styles, mediaOpeningBrace);
  assert.ok(mediaBody, "expected a complete reduced-motion media block");
  const footerBrandRule = cssRuleBody(
    mediaBody,
    '.experience[data-scene-ready="true"] > .site-footer .footer-brand',
  );
  assert.ok(footerBrandRule, "expected the footer brand selector inside reduced motion");
  assert.match(footerBrandRule, /(?:^|;)\s*animation\s*:\s*none\s*;/);
}

test("the canonical brand uses the intended trademark treatments", async () => {
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
  assert.equal((app.match(/™/g) ?? []).length, 2);
  assert.equal((html.match(/™/g) ?? []).length, 0);
  assert.match(app, /<span className="footer-brand">SUPERNEO™<\/span>/);
  assert.doesNotMatch(app, /© 2026 ACTUAL LTD\./);
  assert.doesNotMatch(app, /brand-tm brand-tm--domain/);
  assert.match(app, /brand-tm brand-tm--stage/);
  assert.match(app, /showTrademark/);
  assert.match(app, /<StageWord[\s\S]*showTrademark[\s\S]*\/>/);
  assert.match(app, /aria-label=\{item\.title\}/);
  assert.match(styles, /\.superneo-word\s*{[^}]*padding-right:\s*0\.32em/s);
  assert.match(styles, /\.brand-tm--stage\s*{[^}]*position:\s*absolute/s);
  assert.match(styles, /\.brand-tm--stage\s*{[^}]*top:\s*0/s);
  assert.match(styles, /\.brand-tm--stage\s*{[^}]*color:\s*var\(--bone\)/s);
  assert.match(styles, /\.brand-tm--stage\s*{[^}]*font-size:\s*0\.18em/s);
  assert.match(styles, /\.brand-tm--stage\s*{[^}]*var\(--bone\) 28%/s);
  const footerBrandRule = styles.match(/\.footer-brand\s*{([^}]*)}/)?.[1];
  assert.ok(footerBrandRule, "expected the footer brand rule");
  assert.match(footerBrandRule, /white-space:\s*nowrap/);
  assert.match(footerBrandRule, /clip-path:\s*inset\(0\)/);
  assert.doesNotMatch(footerBrandRule, /(?:^|\s)(?:width|overflow):/);
  assert.match(styles, /footer-brand-reveal 470ms steps\(9, end\) 420ms backwards/);
  assert.match(styles, /@keyframes footer-brand-reveal\s*{[\s\S]*?clip-path:\s*inset\(0 100% 0 0\)[\s\S]*?clip-path:\s*inset\(0\)/);
  assertReducedMotionDisablesFooterBrand(styles);
  const declarationMovedOutsideRule = styles.replace(
    "    animation: none;\n  }\n\n  .stage-panel,",
    "  }\n\n  .footer-brand {\n    animation: none;\n  }\n\n  .stage-panel,",
  );
  assert.notEqual(declarationMovedOutsideRule, styles, "negative control must alter the CSS");
  assert.throws(
    () => assertReducedMotionDisablesFooterBrand(declarationMovedOutsideRule),
    /animation/,
  );
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
