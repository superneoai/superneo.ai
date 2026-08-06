import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseSceneQa } from "../src/sceneQa.ts";

test("development scene QA controls accept only bounded known states", () => {
  assert.deepEqual(
    parseSceneQa("?neoState=medium&sceneFault=shader&sceneDelay=1750"),
    {
      neoState: "medium",
      sceneFault: "shader",
      sceneDelay: 1750,
    },
  );
  assert.deepEqual(
    parseSceneQa("?neoState=bright&sceneFault=network&sceneDelay=999999"),
    {
      neoState: null,
      sceneFault: null,
      sceneDelay: 10_000,
    },
  );
  assert.deepEqual(parseSceneQa("?sceneDelay=-20"), {
    neoState: null,
    sceneFault: null,
    sceneDelay: 0,
  });
});

test("production passes no query-controlled QA configuration to the scene", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(
    app,
    /const sceneQa = import\.meta\.env\.DEV\s*\? parseSceneQa\(window\.location\.search\)\s*:\s*null;/,
  );
});
