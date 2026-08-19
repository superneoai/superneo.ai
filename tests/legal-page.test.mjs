import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const normalizeText = (markup) => markup
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .replace(/\s+([.,;:!?])/g, "$1")
  .trim();

const elementContents = (html, tagName) => [...html.matchAll(
  new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi"),
)].map((match) => match[1]);

const jsonLdDocuments = (html) => [...html.matchAll(
  /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
)].map((match) => JSON.parse(match[1]));

test("the legal page identifies the operator and ownership without overclaiming", async () => {
  const legal = await readFile(new URL("../public/legal/index.html", import.meta.url), "utf8");
  const privacy = await readFile(new URL("../public/privacy/index.html", import.meta.url), "utf8");
  const main = elementContents(legal, "main")[0];
  const paragraphs = elementContents(main, "p").map(normalizeText);
  const page = jsonLdDocuments(legal)[0];

  assert.equal(normalizeText(elementContents(legal, "h1")[0]), "Legal");
  assert.ok(paragraphs.includes("SYSTEM // LEGAL"));
  assert.ok(paragraphs.includes("Operator. superneo.ai is operated by ACTUAL LTD."));
  assert.ok(paragraphs.includes(
    "Brand. SUPERNEO ™ is a trademark of ACTUAL LTD., used here as an unregistered mark. " +
    "NEO is a product name of ACTUAL LTD. No registration is claimed.",
  ));
  assert.ok(paragraphs.includes(
    "Copyright. © 2026 ACTUAL LTD. Site content, design, and the SUPERNEO wordmark treatment " +
    "are © ACTUAL LTD. unless a file states otherwise. Open-source components remain under " +
    "their own licenses and copyright notices.",
  ));
  assert.ok(paragraphs.includes("Contact. hello@superneo.ai"));
  assert.ok(paragraphs.includes("Privacy. See Privacy."));
  assert.doesNotMatch(normalizeText(main), /\buniqu(?:e|ely|eness)\b|registered trademark/i);
  assert.equal((legal.match(/™/g) ?? []).length, 1);
  assert.doesNotMatch(legal, /®/);

  const links = [...legal.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: match[1].match(/\bhref="([^"]+)"/)?.[1],
    label: normalizeText(match[2]),
  }));
  assert.deepEqual(links, [
    { href: "../", label: "BACK" },
    { href: "mailto:hello@superneo.ai", label: "hello@superneo.ai" },
    { href: "../privacy/", label: "Privacy" },
  ]);
  assert.match(legal, /class="back"[^>]*aria-label="Back to superneo\.ai"/);
  assert.match(legal, /\.back \{[^}]*min-height: 44px/);
  assert.equal(elementContents(legal, "style")[0], elementContents(privacy, "style")[0]);

  assert.equal(page["@type"], "WebPage");
  assert.equal(page.url, "https://superneo.ai/legal/");
  assert.deepEqual(page.isPartOf, { "@id": "https://superneo.ai/#website" });
  assert.deepEqual(page.about, { "@id": "https://superneo.ai/#organization" });
  assert.equal(page.dateModified, "2026-08-19");
  assert.doesNotMatch((legal.match(/<meta\b[^>]*>/g) ?? []).join("\n"), /™|®/);
});

test("structured data never presents SUPERNEO as an Organization", async () => {
  const documents = await Promise.all([
    "../index.html",
    "../public/privacy/index.html",
    "../public/legal/index.html",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const entities = documents.flatMap(jsonLdDocuments).flatMap((document) =>
    document["@graph"] ?? [document]);

  assert.equal(entities.some(
    (entity) => entity["@type"] === "Organization" && entity.name === "SUPERNEO",
  ), false);
});
