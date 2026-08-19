import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import test from "node:test";

// Raw bytes track parse and compile cost; gzip tracks what the visitor downloads.
const CHUNK_BUDGETS = new Map([
  ["three", { raw: 600_000, gzip: 155_000 }],
  ["gsap", { raw: 150_000, gzip: 55_000 }],
  ["LatentField", { raw: 100_000, gzip: 30_000 }],
]);
// The scene loads every one of its chunks at once, so the split must not let the
// payload grow behind smaller per-chunk numbers.
const SCENE_PAYLOAD_BUDGET = { raw: 750_000, gzip: 200_000 };
const ENTRY_BUDGET = { raw: 300_000, gzip: 100_000 };
const ORDINARY_CHUNK_BUDGET = { raw: 500_000, gzip: 160_000 };

const assetsUrl = new URL("../dist/assets/", import.meta.url);

async function measure(name) {
  const url = new URL(name, assetsUrl);
  const { size } = await stat(url);
  return { name, raw: size, gzip: gzipSync(await readFile(url)).length };
}

function assertWithin(chunk, budget, label) {
  assert.ok(
    chunk.raw <= budget.raw,
    `${label} is ${chunk.raw} raw bytes; budget is ${budget.raw}`,
  );
  assert.ok(
    chunk.gzip <= budget.gzip,
    `${label} is ${chunk.gzip} gzip bytes; budget is ${budget.gzip}`,
  );
}

test("the scene splits into budgeted chunks that stay off the initial path", async () => {
  const javascriptChunks = (await readdir(assetsUrl)).filter((name) => name.endsWith(".js"));
  const sceneChunks = new Map();

  for (const [prefix, budget] of CHUNK_BUDGETS) {
    const matches = javascriptChunks.filter((name) =>
      new RegExp(`^${prefix}-[A-Za-z0-9_-]+\\.js$`).test(name));
    assert.equal(matches.length, 1, `expected exactly one ${prefix} chunk, found ${matches.length}`);
    const chunk = await measure(matches[0]);
    assertWithin(chunk, budget, chunk.name);
    sceneChunks.set(prefix, chunk);
  }

  const payload = [...sceneChunks.values()].reduce(
    (total, chunk) => ({ raw: total.raw + chunk.raw, gzip: total.gzip + chunk.gzip }),
    { raw: 0, gzip: 0 },
  );
  assertWithin(payload, SCENE_PAYLOAD_BUDGET, "the whole scene payload");

  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const initialScripts = [...html.matchAll(
    /<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+\.js)"[^>]*>/gi,
  )].map((match) => match[1]);
  assert.equal(initialScripts.length, 1, "expected one initial JavaScript entry");

  const entryName = initialScripts[0].replace(/^\.\/assets\//, "");
  for (const chunk of sceneChunks.values()) {
    assert.notEqual(entryName, chunk.name, `${chunk.name} must not be the initial entry`);
    assert.ok(
      !html.includes(chunk.name),
      `${chunk.name} must not be preloaded by the initial document`,
    );
  }

  const entry = await measure(entryName);
  assertWithin(entry, ENTRY_BUDGET, `the initial entry ${entry.name}`);

  const entrySource = await readFile(new URL(entryName, assetsUrl), "utf8");
  const sceneChunkName = sceneChunks.get("LatentField").name;
  assert.match(
    entrySource,
    new RegExp(`import\\([^)]*${sceneChunkName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    "the initial entry must load the scene through a dynamic import",
  );

  const budgeted = new Set([entryName, ...[...sceneChunks.values()].map(({ name }) => name)]);
  for (const name of javascriptChunks.filter((chunk) => !budgeted.has(chunk))) {
    assertWithin(await measure(name), ORDINARY_CHUNK_BUDGET, name);
  }
});
