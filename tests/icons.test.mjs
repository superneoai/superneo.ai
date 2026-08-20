import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const PAGES = ["index.html", "privacy/index.html", "legal/index.html"];
const FILES = [
  "favicon.svg",
  "favicon.ico",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "site.webmanifest",
];

const dist = (path) => new URL(`../dist/${path}`, import.meta.url);

test("every page links an icon set that the build ships", async () => {
  for (const file of FILES) {
    const { size } = await stat(dist(file));
    assert.ok(size > 0, `${file} is empty`);
  }

  for (const page of PAGES) {
    const html = await readFile(dist(page), "utf8");
    const links = [...html.matchAll(
      /<link rel="(icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g,
    )].map(([, rel, href]) => [rel, href.replace(/^\.?\//, "")]);

    const rels = links.map(([rel]) => rel);
    assert.ok(rels.includes("icon"), `${page} links no icon`);
    assert.ok(rels.includes("apple-touch-icon"), `${page} links no apple touch icon`);
    assert.ok(rels.includes("manifest"), `${page} links no manifest`);

    for (const [rel, href] of links) {
      const { size } = await stat(dist(href));
      assert.ok(size > 0, `${page} ${rel} points at an empty ${href}`);
    }
  }
});

test("the shipped icon is the brand master itself", async () => {
  const master = await readFile(new URL("../brand/e-square.svg", import.meta.url), "utf8");
  const favicon = await readFile(dist("favicon.svg"), "utf8");
  assert.equal(favicon, master, "favicon.svg must stay identical to brand/e-square.svg");
  assert.match(master, /fill="#BAF628"/);

  const manifest = JSON.parse(await readFile(dist("site.webmanifest"), "utf8"));
  assert.equal(manifest.name, "SUPERNEO");
  assert.equal(manifest.background_color, "#030403");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
});
