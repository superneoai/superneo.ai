import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\.site-footer \.footer-brand,(?:\s*[^{}]+,)*\s*[^{}]+{[^}]*animation:\s*none;?[^}]*}/);
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
