import assert from "node:assert/strict";
import test from "node:test";
import {
  createNeoformPoseSampler,
  NEOFORM_JOINTS,
  sampleNeoformPose,
} from "../src/neoformRig.ts";

const joint = (pose: Float32Array, index: number) => ({
  x: pose[index * 3],
  y: pose[index * 3 + 1],
  z: pose[index * 3 + 2],
});

test("the shared rig reads as an upright biped at the latent endpoint", () => {
  const pose = sampleNeoformPose({ time: 0.8, formBlend: 0, speed: 0.65, leap: 0 });
  const core = joint(pose, NEOFORM_JOINTS.core);
  const head = joint(pose, NEOFORM_JOINTS.head);
  const leftFoot = joint(pose, NEOFORM_JOINTS.rearLeftTip);
  const rightFoot = joint(pose, NEOFORM_JOINTS.rearRightTip);

  assert.ok(head.y - core.y > 0.65);
  assert.ok(leftFoot.y < 0.16 && rightFoot.y < 0.16);
  assert.ok(Math.abs(leftFoot.z - rightFoot.z) > 0.25);
});

test("the same joints resolve into a horizontal quadruped", () => {
  const pose = sampleNeoformPose({ time: 1.2, formBlend: 1, speed: 1.3, leap: 0 });
  const core = joint(pose, NEOFORM_JOINTS.core);
  const head = joint(pose, NEOFORM_JOINTS.head);
  const frontFoot = joint(pose, NEOFORM_JOINTS.frontLeftTip);
  const rearFoot = joint(pose, NEOFORM_JOINTS.rearLeftTip);

  assert.ok(head.x - core.x > 0.65);
  assert.ok(Math.abs(head.y - core.y) < 0.25);
  assert.ok(frontFoot.y < 0.18 && rearFoot.y < 0.18);
});

test("form blending is continuous and deterministic", () => {
  const sampler = createNeoformPoseSampler();
  const before = sampler({ time: 2, formBlend: 0.49, speed: 1, leap: 0 });
  const after = sampler({ time: 2, formBlend: 0.51, speed: 1, leap: 0 });
  let maximumDelta = 0;
  for (let index = 0; index < before.length; index += 1) {
    maximumDelta = Math.max(maximumDelta, Math.abs(before[index] - after[index]));
  }
  assert.ok(maximumDelta < 0.08, `joint snap was ${maximumDelta.toFixed(3)}`);
});

test("settled forms bypass the unused pose branch", () => {
  const rig = sampleNeoformPose({ time: 2.4, formBlend: 1, speed: 1.4, leap: 0 });
  const nearlySettled = sampleNeoformPose({
    time: 2.4,
    formBlend: 0.9999,
    speed: 1.4,
    leap: 0,
  });
  assert.deepEqual(nearlySettled, rig);
});

test("the final leap lifts the body and tucks every foot", () => {
  const grounded = sampleNeoformPose({ time: 1.4, formBlend: 1, speed: 1.4, leap: 0 });
  const airborne = sampleNeoformPose({ time: 1.4, formBlend: 1, speed: 1.4, leap: 1 });
  const groundedCore = joint(grounded, NEOFORM_JOINTS.core);
  const airborneCore = joint(airborne, NEOFORM_JOINTS.core);
  const airborneFeet = [
    NEOFORM_JOINTS.frontLeftTip,
    NEOFORM_JOINTS.frontRightTip,
    NEOFORM_JOINTS.rearLeftTip,
    NEOFORM_JOINTS.rearRightTip,
  ].map((index) => joint(airborne, index));

  assert.ok(airborneCore.y - groundedCore.y > 0.5);
  assert.ok(airborneFeet.every((foot) => foot.y > 0.65));
});
