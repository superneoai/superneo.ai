import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const SCENE_BUDGET_BYTES = 750_000;
const ORDINARY_CHUNK_BUDGET_BYTES = 500_000;

test("the lazy scene and ordinary JavaScript chunks stay within their budgets", async () => {
  const assetsUrl = new URL("../dist/assets/", import.meta.url);
  const assetNames = await readdir(assetsUrl);
  const javascriptChunks = assetNames.filter((name) => name.endsWith(".js"));
  const sceneChunks = javascriptChunks.filter((name) =>
    /^LatentField-[A-Za-z0-9_-]+\.js$/.test(name));

  assert.equal(sceneChunks.length, 1, "expected one independently emitted LatentField chunk");
  const [sceneChunk] = sceneChunks;
  const sceneSize = (await stat(new URL(sceneChunk, assetsUrl))).size;
  assert.ok(
    sceneSize <= SCENE_BUDGET_BYTES,
    `${sceneChunk} is ${sceneSize} bytes; lazy scene budget is ${SCENE_BUDGET_BYTES}`,
  );

  for (const chunk of javascriptChunks.filter((name) => name !== sceneChunk)) {
    const size = (await stat(new URL(chunk, assetsUrl))).size;
    assert.ok(
      size <= ORDINARY_CHUNK_BUDGET_BYTES,
      `${chunk} is ${size} bytes; ordinary chunk budget is ${ORDINARY_CHUNK_BUDGET_BYTES}`,
    );
  }

  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const initialScripts = [...html.matchAll(
    /<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+\.js)"[^>]*>/gi,
  )].map((match) => match[1]);
  assert.equal(initialScripts.length, 1, "expected one initial JavaScript entry");
  assert.doesNotMatch(initialScripts[0], /LatentField-/);

  const entryUrl = new URL(initialScripts[0].replace(/^\.\//, "../dist/"), import.meta.url);
  const entrySource = await readFile(entryUrl, "utf8");
  const escapedSceneChunk = sceneChunk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    entrySource,
    new RegExp(`import\\([^)]*${escapedSceneChunk}`),
    "the initial entry must load LatentField through a dynamic import",
  );
});
