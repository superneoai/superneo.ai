import assert from "node:assert/strict";
import test from "node:test";
import { selectSceneFallback } from "./browser-scene.mjs";

const softwareWebGL = {
  browserContextAvailable: true,
  applicationContextAvailable: true,
  contextLost: false,
  renderer: "ANGLE (Google, SwiftShader driver)",
  softwareRenderer: true,
};

test("the scene fallback gate admits only a healthy software renderer", () => {
  assert.match(selectSceneFallback(softwareWebGL), /software WebGL renderer/);
  assert.throws(
    () => selectSceneFallback({
      ...softwareWebGL,
      applicationContextAvailable: false,
    }),
    /application renderer did not initialize/,
  );
  assert.throws(
    () => selectSceneFallback(softwareWebGL, ["SUPERNEO shader compilation failed"]),
    /scene failed before readiness/,
  );
  assert.throws(
    () => selectSceneFallback({ ...softwareWebGL, contextLost: true }),
    /context was lost/,
  );
  assert.equal(selectSceneFallback({
    ...softwareWebGL,
    renderer: "ANGLE (NVIDIA GeForce RTX 4090)",
    softwareRenderer: false,
  }), null);
});
