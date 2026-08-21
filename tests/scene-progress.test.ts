import assert from "node:assert/strict";
import test from "node:test";
import {
  createSceneProgressController,
  SCENE_PROGRESS_EVENT,
} from "../src/sceneProgress.ts";

test("scene progress snapshots publish only after the requested phase renders", () => {
  const target = new EventTarget();
  const host = { dataset: {} as DOMStringMap };
  const requested: Array<{ progress: number; signalPhase: string; revision: number }> = [];
  const controller = createSceneProgressController({
    eventTarget: target,
    host,
    onProgress: (snapshot) => requested.push(snapshot),
  });

  controller.publish();
  assert.deepEqual(JSON.parse(host.dataset.qaSceneProgress ?? "null"), {
    progress: 1.7,
    signalPhase: "idle",
    revision: 0,
  });

  target.dispatchEvent(new CustomEvent(SCENE_PROGRESS_EVENT, {
    detail: { signalPhase: "arrival" },
  }));
  assert.deepEqual(requested.at(-1), {
    progress: 0.83,
    signalPhase: "arrival",
    revision: 1,
  });
  assert.equal(
    JSON.parse(host.dataset.qaSceneProgress ?? "null").signalPhase,
    "idle",
    "the queryable snapshot must not advance ahead of the rendered frame",
  );

  controller.publish();
  assert.deepEqual(JSON.parse(host.dataset.qaSceneProgress ?? "null"), requested.at(-1));

  target.dispatchEvent(new CustomEvent(SCENE_PROGRESS_EVENT, {
    detail: { signalPhase: "unknown" },
  }));
  controller.publish();
  assert.deepEqual(JSON.parse(host.dataset.qaSceneProgress ?? "null"), requested.at(-1));

  controller.dispose();
  target.dispatchEvent(new CustomEvent(SCENE_PROGRESS_EVENT, {
    detail: { signalPhase: "fade" },
  }));
  assert.equal(requested.length, 1);
});
