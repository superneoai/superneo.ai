import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { parseSceneQa } from "../src/sceneQa.ts";

test("development scene QA controls accept only bounded known states", () => {
  assert.deepEqual(
    parseSceneQa(
      "?neoState=medium&sceneFault=shader&sceneDelay=1750&freezeScene=1&reducedMotion=1&objectMask=1&sceneProgress=1",
    ),
    {
      neoState: "medium",
      sceneFault: "shader",
      sceneDelay: 1750,
      freezeScene: true,
      reducedMotion: true,
      objectMask: true,
      sceneProgress: true,
    },
  );
  assert.deepEqual(
    parseSceneQa("?neoState=bright&sceneFault=network&sceneDelay=999999"),
    {
      neoState: null,
      sceneFault: null,
      sceneDelay: 10_000,
      freezeScene: false,
      reducedMotion: false,
      objectMask: false,
      sceneProgress: false,
    },
  );
  assert.deepEqual(parseSceneQa("?sceneDelay=-20"), {
    neoState: null,
    sceneFault: null,
    sceneDelay: 0,
    freezeScene: false,
    reducedMotion: false,
    objectMask: false,
    sceneProgress: false,
  });
});

test("production passes no query-controlled QA configuration to the scene", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(
    app,
    /const sceneQa = import\.meta\.env\.DEV\s*\? parseSceneQa\(window\.location\.search\)\s*:\s*null;/,
  );
});

test("scene progress controls are absent from the production bundle", async () => {
  const assets = new URL("../dist/assets/", import.meta.url);
  const scripts = (await readdir(assets)).filter((filename) => filename.endsWith(".js"));
  const source = (await Promise.all(
    scripts.map((filename) => readFile(new URL(filename, assets), "utf8")),
  )).join("\n");

  assert.doesNotMatch(source, /superneo:qa-scene-progress|qaSceneProgress/);
});
