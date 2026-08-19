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
  const brand = jsonLd["@graph"].find((item) => item["@type"] === "Brand");
  const webpage = jsonLd["@graph"].find((item) => item["@type"] === "WebPage");
  const image = jsonLd["@graph"].find((item) => item["@type"] === "ImageObject");
  const socialAlt = "An abstract white and green web on black, titled The New State, with superneo.ai.";

  assert.match(html, /name="twitter:site" content="@superneoai"/);
  assert.match(html, /<title>superneo\.ai<\/title>/);
  assert.match(html, /name="author" content="SUPERNEO"/);
  assert.match(html, /name="description" content="In the making\."/);
  assert.doesNotMatch((html.match(/<meta\b[^>]*>/g) ?? []).join("\n"), /™|®/);
  assert.match(html, new RegExp(`property="og:image:alt" content="${socialAlt.replaceAll(".", "\\.")}"`));
  assert.match(html, new RegExp(`name="twitter:image:alt" content="${socialAlt.replaceAll(".", "\\.")}"`));
  assert.match(html, /rel="alternate" hreflang="x-default"/);
  assert.match(html, /<noscript>[\s\S]*?<h1>SUPERNEO<\/h1>[\s\S]*?href="\.\/privacy\/"[\s\S]*?href="\.\/legal\/"/);
  assert.doesNotMatch(html, /rel="(?:shortcut )?icon"|apple-touch-icon|site\.webmanifest/i);
  assert.equal(website.name, "SUPERNEO");
  assert.equal(website.alternateName, "superneo.ai");
  assert.deepEqual(website.publisher, { "@id": "https://superneo.ai/#organization" });
  assert.equal(organization.name, "ACTUAL LTD.");
  assert.equal(organization.legalName, "ACTUAL LTD.");
  assert.equal(organization.url, "https://actual.ltd/");
  assert.equal(organization.contactPoint.email, "hello@superneo.ai");
  assert.deepEqual(organization.brand, { "@id": "https://superneo.ai/#brand" });
  assert.equal(brand.name, "SUPERNEO");
  assert.deepEqual(brand.sameAs, ["https://x.com/superneoai"]);
  assert.deepEqual(webpage.about, { "@id": "https://superneo.ai/#brand" });
  assert.equal(webpage.dateModified, "2026-08-19");
  assert.equal(image.contentUrl, "https://superneo.ai/og.png");
  assert.equal(jsonLd["@graph"].some(
    (item) => item["@type"] === "Organization" && item.name === "SUPERNEO"
  ), false);
  for (const entity of [organization, brand]) {
    assert.equal("logo" in entity, false);
    assert.equal("trademark" in entity, false);
  }
  assert.doesNotMatch(JSON.stringify(jsonLd), /registered|registration|™|®/i);
});

test("answer engines receive a restrained canonical site summary", async () => {
  const llms = await readFile(new URL("../public/llms.txt", import.meta.url), "utf8");
  const privacy = await readFile(new URL("../public/privacy/index.html", import.meta.url), "utf8");

  assert.match(llms, /^# SUPERNEO\n/);
  assert.match(llms, /^> The official website of SUPERNEO\./m);
  assert.match(llms, /\[Official website\]\(https:\/\/superneo\.ai\/\)/);
  assert.match(llms, /\[Privacy\]\(https:\/\/superneo\.ai\/privacy\/\)/);
  assert.match(llms, /\[Legal\]\(https:\/\/superneo\.ai\/legal\/\)/);
  assert.match(llms, /SUPERNEO is a brand of ACTUAL LTD\./);
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

  const entries = [...sitemap.matchAll(
    /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g,
  )].map(([, location, lastModified]) => [location, lastModified]);

  assert.deepEqual(entries, [
    ["https://superneo.ai/", "2026-08-19"],
    ["https://superneo.ai/privacy/", "2026-08-19"],
    ["https://superneo.ai/legal/", "2026-08-19"],
  ]);
});
