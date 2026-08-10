import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("metadata connects search, social, structured data, and mobile identity", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const jsonLdSource = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(jsonLdSource, "expected JSON-LD metadata");
  const jsonLd = JSON.parse(jsonLdSource[1]);
  const organization = jsonLd["@graph"].find((item) => item["@type"] === "Organization");
  const image = jsonLd["@graph"].find((item) => item["@type"] === "ImageObject");
  const socialAlt = "An abstract white and green web on black, titled The New State, with superneo.ai.";

  assert.match(html, /name="twitter:site" content="@superneoai"/);
  assert.match(html, /<title>superneo\.ai<\/title>/);
  assert.match(html, /name="description" content="In the making\."/);
  assert.match(html, new RegExp(`property="og:image:alt" content="${socialAlt.replaceAll(".", "\\.")}"`));
  assert.match(html, new RegExp(`name="twitter:image:alt" content="${socialAlt.replaceAll(".", "\\.")}"`));
  assert.match(html, /rel="alternate" hreflang="x-default"/);
  assert.doesNotMatch(html, /rel="(?:shortcut )?icon"|apple-touch-icon|site\.webmanifest/i);
  assert.equal(organization.name, "SUPERNEO");
  assert.deepEqual(organization.sameAs, ["https://x.com/superneoai"]);
  assert.equal(image.contentUrl, "https://superneo.ai/og.png");
});

test("sitemap records the latest material page revision", async () => {
  const sitemap = await readFile(
    new URL("../public/sitemap.xml", import.meta.url),
    "utf8",
  );

  assert.match(sitemap, /<loc>https:\/\/superneo\.ai\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/superneo\.ai\/privacy\/<\/loc>/);
  assert.match(sitemap, /<lastmod>2026-08-10<\/lastmod>/);
});
