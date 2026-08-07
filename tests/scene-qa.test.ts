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
      showcaseAct: null,
      showcaseTransition: null,
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
      showcaseAct: null,
      showcaseTransition: null,
    },
  );
  assert.deepEqual(parseSceneQa("?sceneDelay=-20"), {
    neoState: null,
    sceneFault: null,
    sceneDelay: 0,
    freezeScene: false,
    reducedMotion: false,
    objectMask: false,
    showcaseAct: null,
    showcaseTransition: null,
  });
});

test("development QA can lock showcase acts and transition checkpoints", () => {
  assert.deepEqual(parseSceneQa("?qaAct=island&qaTransition=.75"), {
    neoState: null,
    sceneFault: null,
    sceneDelay: 0,
    freezeScene: false,
    reducedMotion: false,
    objectMask: false,
    showcaseAct: 2,
    showcaseTransition: 0.75,
  });
  assert.equal(parseSceneQa("?qaAct=unknown&qaTransition=4").showcaseAct, null);
  assert.equal(parseSceneQa("?qaAct=unknown&qaTransition=4").showcaseTransition, 1);
});

test("production passes no query-controlled QA configuration to the scene", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(
    app,
    /const sceneQa = useMemo\(\(\) => import\.meta\.env\.DEV\s*\? parseSceneQa\(window\.location\.search\)\s*:\s*null, \[\]\);/,
  );
});
