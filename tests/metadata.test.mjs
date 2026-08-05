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

  assert.match(html, /name="twitter:site" content="@superneoai"/);
  assert.match(html, /rel="alternate" hreflang="x-default"/);
  assert.doesNotMatch(html, /rel="(?:shortcut )?icon"|apple-touch-icon|site\.webmanifest/i);
  assert.deepEqual(organization.sameAs, ["https://x.com/superneoai"]);
  assert.equal(image.contentUrl, "https://superneo.ai/og.png");
});
