import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseSceneQa } from "../src/sceneQa.ts";

test("development scene QA controls accept only bounded known states", () => {
  assert.deepEqual(
    parseSceneQa(
      "?neoState=medium&sceneFault=shader&sceneDelay=1750&freezeScene=1&reducedMotion=1&objectMask=1",
    ),
    {
      neoState: "medium",
      sceneFault: "shader",
      sceneDelay: 1750,
      freezeScene: true,
      reducedMotion: true,
      objectMask: true,
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
    },
  );
  assert.deepEqual(parseSceneQa("?sceneDelay=-20"), {
    neoState: null,
    sceneFault: null,
    sceneDelay: 0,
    freezeScene: false,
    reducedMotion: false,
    objectMask: false,
  });
});

test("production passes no query-controlled QA configuration to the scene", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(
    app,
    /const sceneQa = import\.meta\.env\.DEV\s*\? parseSceneQa\(window\.location\.search\)\s*:\s*null;/,
  );
});

test("deterministic signal phase controls remain development-only", async () => {
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");

  assert.match(field, /const QA_SIGNAL_PROGRESS_EVENT = "superneo:qa-signal-progress";/);
  assert.match(
    field,
    /if \(import\.meta\.env\.DEV\) \{\s*window\.addEventListener\(QA_SIGNAL_PROGRESS_EVENT, handleQaSignalProgress\);\s*\}/,
  );
  assert.match(
    field,
    /if \(import\.meta\.env\.DEV && qaSignalProgress !== null\)/,
  );
});
