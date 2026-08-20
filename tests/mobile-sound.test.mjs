import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile sound uses device volume and unlocks from the tap", async () => {
  const controller = await readFile(
    new URL("../src/Soundtrack.tsx", import.meta.url),
    "utf8",
  );
  const engine = await readFile(
    new URL("../src/soundtrackEngine.ts", import.meta.url),
    "utf8",
  );
  const stageSignal = await readFile(
    new URL("../src/stageSignal.ts", import.meta.url),
    "utf8",
  );

  assert.match(controller, /deviceVolumeMedia = "\(max-width: 720px\), \(hover: none\) and \(pointer: coarse\)"/);
  assert.match(controller, /new SuperneoSoundtrack\(\{ compact: deviceVolume \}\)/);
  assert.match(controller, /setVolume\(deviceVolume \? 1 : volumeRef\.current \/ 100\)/);
  assert.match(controller, /startingRef\.current/);
  assert.match(controller, /disabled=\{!supported \|\| starting\}/);
  assert.match(controller, /\{!deviceVolume && \(/);
  assert.match(controller, /const stageRef = useRef\(0\)/);
  assert.match(controller, /engineRef\.current\.setStage\(stageRef\.current\)/);
  assert.match(controller, /window\.addEventListener\(STAGE_CHANGE_EVENT, syncStage\)/);
  assert.match(controller, /engineRef\.current\?\.setStage\(stage\)/);
  assert.match(controller, /}, \[deviceVolume\]\);/);
  assert.match(controller, /export const SoundtrackController = memo\(function SoundtrackController\(\)/);
  assert.doesNotMatch(controller, /SoundtrackControllerProps|\[deviceVolume, stage\]/);
  assert.match(stageSignal, /STAGE_CHANGE_EVENT = "superneo:stage-change"/);
  assert.match(stageSignal, /dispatchStageChange\(stage: number, previous: number\)/);
  assert.match(engine, /latencyHint: options\.compact \? "balanced" : "interactive"/);
  assert.match(engine, /Math\.min\(LAST_STAGE, Math\.max\(0, stage\)\)/);
  assert.match(engine, /const cutoff = \[620, 920, 2100\]\[this\.stage\]/);
  assert.doesNotMatch(engine, /\[620, 920, 1380, 2100\]/);
  assert.match(engine, /options\.compact \? null : this\.createImpulseResponse/);
});

test("stage changes cross the soundtrack boundary as typed events", async () => {
  const previousWindow = globalThis.window;
  const target = new EventTarget();
  globalThis.window = target;

  try {
    const {
      STAGE_CHANGE_EVENT,
      dispatchStageChange,
    } = await import("../src/stageSignal.ts");
    const received = new Promise((resolve) => {
      target.addEventListener(STAGE_CHANGE_EVENT, (event) => {
        resolve(event.detail);
      }, { once: true });
    });

    dispatchStageChange(2, 1);
    assert.deepEqual(await received, { stage: 2, previous: 1 });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
