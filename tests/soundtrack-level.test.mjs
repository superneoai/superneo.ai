import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function captureNumber(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `expected ${label} in the soundtrack source`);
  return Number(match[1]);
}

test("the default soundtrack mix has an immediately audible dry signal", async () => {
  const engine = await readFile(
    new URL("../src/soundtrackEngine.ts", import.meta.url),
    "utf8",
  );
  const controller = await readFile(
    new URL("../src/Soundtrack.tsx", import.meta.url),
    "utf8",
  );

  const defaultVolume = captureNumber(controller, /defaultVolume = ([\d.]+)/, "default volume") / 100;
  const outputScale = captureNumber(
    engine,
    /master\.gain\.exponentialRampToValueAtTime\(\s+Math\.max\(this\.volume \* ([\d.]+)/,
    "master output scale",
  );
  const bassLevel = captureNumber(
    engine,
    /type: "triangle",\s+level: ([\d.]+),\s+attack: 0\.035/,
    "bass level",
  );
  const padTriangle = captureNumber(
    engine,
    /type: "triangle",\s+level: ([\d.]+),\s+attack: 0\.58/,
    "pad triangle level",
  );
  const padSine = captureNumber(
    engine,
    /type: "sine",\s+level: ([\d.]+),\s+attack: 0\.72/,
    "pad sine level",
  );
  const sfxScale = captureNumber(
    engine,
    /sfxBus\.gain\.value = this\.volume \* ([\d.]+)/,
    "SFX output scale",
  );
  const sfxPeak = captureNumber(
    engine,
    /private scheduleTipTone[\s\S]*?envelope\.gain\.exponentialRampToValueAtTime\(([\d.]+),/,
    "tip tone peak",
  );

  const bassReferenceLevel = defaultVolume * outputScale * bassLevel;
  const padReferenceLevel = defaultVolume * outputScale * (padTriangle + padSine) * 3;

  assert.ok(
    bassReferenceLevel >= 0.048,
    `bass dry level ${bassReferenceLevel.toFixed(4)} is effectively inaudible`,
  );
  assert.ok(
    padReferenceLevel >= 0.068,
    `pad dry level ${padReferenceLevel.toFixed(4)} is effectively inaudible`,
  );
  const maximumTipLevel = sfxScale * sfxPeak;
  assert.ok(
    maximumTipLevel >= 0.01 && maximumTipLevel <= 0.014,
    `maximum tip level ${maximumTipLevel.toFixed(4)} should remain audible but restrained`,
  );
});
