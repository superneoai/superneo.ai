import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("metadata connects search, social, structured data, and mobile identity", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const jsonLdSource = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(jsonLdSource, "expected JSON-LD metadata");
  const jsonLd = JSON.parse(jsonLdSource[1]);
  const website = jsonLd["@graph"].find((item) => item["@type"] === "WebSite");
  const organization = jsonLd["@graph"].find((item) => item["@type"] === "Organization");
  const image = jsonLd["@graph"].find((item) => item["@type"] === "ImageObject");
  const socialAlt = "An abstract white and green web on black, titled The New State, with superneo.ai.";

  assert.match(html, /name="twitter:site" content="@superneoai"/);
  assert.match(html, /<title>superneo\.ai<\/title>/);
  assert.match(html, /name="description" content="In the making\."/);
  assert.match(html, new RegExp(`property="og:image:alt" content="${socialAlt.replaceAll(".", "\\.")}"`));
  assert.match(html, new RegExp(`name="twitter:image:alt" content="${socialAlt.replaceAll(".", "\\.")}"`));
  assert.match(html, /rel="alternate" hreflang="x-default"/);
  assert.match(html, /<noscript>[\s\S]*?<h1>SUPERNEO<\/h1>[\s\S]*?href="\.\/privacy\/"/);
  assert.doesNotMatch(html, /rel="(?:shortcut )?icon"|apple-touch-icon|site\.webmanifest/i);
  assert.equal(website.name, "SUPERNEO");
  assert.equal(website.alternateName, "superneo.ai");
  assert.equal(organization.name, "SUPERNEO");
  assert.equal(organization.contactPoint.email, "hello@superneo.ai");
  assert.deepEqual(organization.sameAs, ["https://x.com/superneoai"]);
  assert.equal(image.contentUrl, "https://superneo.ai/og.png");
});

test("answer engines receive a restrained canonical site summary", async () => {
  const llms = await readFile(new URL("../public/llms.txt", import.meta.url), "utf8");
  const privacy = await readFile(new URL("../public/privacy/index.html", import.meta.url), "utf8");

  assert.match(llms, /^# SUPERNEO\n/);
  assert.match(llms, /^> The official website of SUPERNEO\./m);
  assert.match(llms, /\[Official website\]\(https:\/\/superneo\.ai\/\)/);
  assert.match(llms, /\[Privacy\]\(https:\/\/superneo\.ai\/privacy\/\)/);
  assert.match(llms, /Do not infer or claim details about unreleased work/);
  assert.doesNotMatch(llms, /game engine|multiplexer/i);
  assert.match(privacy, /property="og:site_name" content="SUPERNEO"/);
  assert.match(privacy, /<script type="application\/ld\+json">/);
  await access(new URL("../public/llms.txt", import.meta.url));
});

test("sitemap records the latest material page revision", async () => {
  const sitemap = await readFile(
    new URL("../public/sitemap.xml", import.meta.url),
    "utf8",
  );

  assert.match(sitemap, /<loc>https:\/\/superneo\.ai\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/superneo\.ai\/privacy\/<\/loc>/);
  assert.match(sitemap, /<lastmod>2026-08-11<\/lastmod>/);
});
