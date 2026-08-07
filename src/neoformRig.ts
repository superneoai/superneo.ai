import * as THREE from "three";

export const NEOFORM_JOINTS = {
  core: 0,
  spine: 1,
  chest: 2,
  head: 3,
  frontLeftRoot: 4,
  frontLeftMid: 5,
  frontLeftTip: 6,
  frontRightRoot: 7,
  frontRightMid: 8,
  frontRightTip: 9,
  rearLeftRoot: 10,
  rearLeftMid: 11,
  rearLeftTip: 12,
  rearRightRoot: 13,
  rearRightMid: 14,
  rearRightTip: 15,
  tailRoot: 16,
  tailTip: 17,
  sensor: 18,
} as const;

export const NEOFORM_JOINT_COUNT = 19;

const BONE_PAIRS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0.08],
  [1, 2, 0.2],
  [2, 3, 0.42],
  [3, 18, 0.58],
  [2, 4, 0.18],
  [4, 5, 0.48],
  [5, 6, 0.82],
  [2, 7, 0.18],
  [7, 8, 0.48],
  [8, 9, 0.82],
  [0, 10, 0.18],
  [10, 11, 0.5],
  [11, 12, 0.86],
  [0, 13, 0.18],
  [13, 14, 0.5],
  [14, 15, 0.86],
  [0, 16, 0.22],
  [16, 17, 0.72],
];

const TIP_INDICES = [6, 9, 12, 15, 17, 18] as const;

export type NeoformPoseInput = {
  time: number;
  formBlend: number;
  speed: number;
  leap: number;
  pointerX?: number;
  pointerY?: number;
  pointerStrength?: number;
};

export type NeoformRigUpdate = NeoformPoseInput & {
  assembly: number;
  predictionStrength: number;
  signalProgress: ArrayLike<number>;
  signalVariation: ArrayLike<number>;
  reducedMotion: boolean;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp01((value - from) / Math.max(to - from, 0.0001));
  return t * t * (3 - 2 * t);
};

const fract = (value: number) => value - Math.floor(value);
function signalTravelRate(
  signalIndex: number,
  routeIndex: number,
  variations: ArrayLike<number>,
) {
  const variation = variations[signalIndex] ?? 0.5;
  const routeJitter = fract(Math.sin(
    (signalIndex + 1) * 17.71 + (routeIndex + 1) * 43.13 + variation * 91.37,
  ) * 43758.5453);
  return 1.22 + routeJitter * 0.28;
}

function setJoint(target: Float32Array, joint: number, x: number, y: number, z: number) {
  const offset = joint * 3;
  target[offset] = x;
  target[offset + 1] = y;
  target[offset + 2] = z;
}

function getJoint(target: Float32Array, joint: number, output: THREE.Vector3) {
  const offset = joint * 3;
  return output.set(target[offset], target[offset + 1], target[offset + 2]);
}

function solveLimb(
  target: Float32Array,
  rootIndex: number,
  midIndex: number,
  tipIndex: number,
  root: THREE.Vector3,
  tip: THREE.Vector3,
  lengthA: number,
  lengthB: number,
  bend: THREE.Vector3,
  scratchDirection: THREE.Vector3,
  scratchPerpendicular: THREE.Vector3,
) {
  scratchDirection.copy(tip).sub(root);
  const distance = THREE.MathUtils.clamp(
    scratchDirection.length(),
    Math.abs(lengthA - lengthB) + 0.001,
    lengthA + lengthB - 0.001,
  );
  scratchDirection.normalize();
  const along = (lengthA * lengthA - lengthB * lengthB + distance * distance) /
    (2 * distance);
  const height = Math.sqrt(Math.max(lengthA * lengthA - along * along, 0));
  scratchPerpendicular
    .copy(bend)
    .addScaledVector(scratchDirection, -bend.dot(scratchDirection))
    .normalize();
  if (scratchPerpendicular.lengthSq() < 0.001) scratchPerpendicular.set(0, 0, 1);
  const mid = scratchPerpendicular.multiplyScalar(height)
    .addScaledVector(scratchDirection, along)
    .add(root);
  setJoint(target, rootIndex, root.x, root.y, root.z);
  setJoint(target, midIndex, mid.x, mid.y, mid.z);
  setJoint(target, tipIndex, tip.x, tip.y, tip.z);
}

function sampleBiped(
  input: NeoformPoseInput,
  target: Float32Array,
  scratch: PoseScratch,
) {
  const speed = THREE.MathUtils.clamp(input.speed, 0.35, 1.7);
  const cycle = input.time * (3.5 + speed * 2.2);
  const bob = Math.sin(cycle * 2) * 0.025 * speed;
  const pointerStrength = input.pointerStrength ?? 0;
  const lookX = THREE.MathUtils.clamp(input.pointerX ?? 0, -1, 1) *
    pointerStrength * 0.075;
  const lookY = THREE.MathUtils.clamp(input.pointerY ?? 0, -0.4, 1.8) *
    pointerStrength * 0.035;

  setJoint(target, 0, 0, 0.74 + bob, 0);
  setJoint(target, 1, 0.015, 0.99 + bob, 0);
  setJoint(target, 2, 0.045, 1.24 + bob, 0);
  setJoint(target, 3, 0.11 + lookX, 1.49 + bob + lookY, 0);
  setJoint(target, 18, 0.25 + lookX, 1.55 + bob + lookY, 0);
  setJoint(target, 16, -0.1, 0.77 + bob, 0);
  setJoint(target, 17, -0.34, 0.84 + bob + Math.sin(cycle * 0.5) * 0.035, 0);

  const frontRoots = [4, 7] as const;
  const frontMids = [5, 8] as const;
  const frontTips = [6, 9] as const;
  const rearRoots = [10, 13] as const;
  const rearMids = [11, 14] as const;
  const rearTips = [12, 15] as const;

  for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
    const side = sideIndex === 0 ? 1 : -1;
    const phase = cycle + sideIndex * Math.PI;
    const armSwing = Math.sin(phase + Math.PI) * 0.24 * speed;
    scratch.root.set(0.035, 1.2 + bob, side * 0.27);
    scratch.tip.set(armSwing + 0.04, 0.78 + bob, side * 0.31);
    scratch.bend.set(0.18, -0.15, side);
    solveLimb(
      target,
      frontRoots[sideIndex],
      frontMids[sideIndex],
      frontTips[sideIndex],
      scratch.root,
      scratch.tip,
      0.27,
      0.28,
      scratch.bend,
      scratch.direction,
      scratch.perpendicular,
    );

    const stride = Math.sin(phase) * (0.18 + speed * 0.08);
    const swingLift = Math.pow(Math.max(Math.sin(phase), 0), 1.6) *
      (0.07 + speed * 0.045);
    scratch.root.set(-0.015, 0.72 + bob, side * 0.145);
    scratch.tip.set(stride, 0.025 + swingLift, side * 0.16);
    scratch.bend.set(0.35, 0.05, side * 0.18);
    solveLimb(
      target,
      rearRoots[sideIndex],
      rearMids[sideIndex],
      rearTips[sideIndex],
      scratch.root,
      scratch.tip,
      0.39,
      0.39,
      scratch.bend,
      scratch.direction,
      scratch.perpendicular,
    );
  }
}

function sampleQuadruped(
  input: NeoformPoseInput,
  target: Float32Array,
  scratch: PoseScratch,
) {
  const speed = THREE.MathUtils.clamp(input.speed, 0.55, 1.8);
  const cycle = input.time * (4.6 + speed * 2.8);
  const bound = Math.sin(cycle * 2) * 0.03 * speed;
  const leapLift = smoothstep(0, 1, input.leap) * 0.58;
  const tuck = smoothstep(0.12, 0.86, input.leap);
  const pointerStrength = input.pointerStrength ?? 0;
  const lookX = THREE.MathUtils.clamp(input.pointerX ?? 0, -1, 1) *
    pointerStrength * 0.08;

  setJoint(target, 0, -0.18, 0.57 + bound + leapLift, 0);
  setJoint(target, 1, 0.05, 0.62 + bound + leapLift, 0);
  setJoint(target, 2, 0.33, 0.64 + bound + leapLift, 0);
  setJoint(target, 3, 0.6 + lookX, 0.7 + bound + leapLift, 0);
  setJoint(target, 18, 0.83 + lookX, 0.67 + bound + leapLift, 0);
  setJoint(target, 16, -0.43, 0.59 + bound + leapLift, 0);
  setJoint(
    target,
    17,
    -0.91,
    0.67 + bound + leapLift + Math.sin(cycle * 0.5) * 0.12,
    Math.cos(cycle * 0.42) * 0.08,
  );

  const roots = [4, 7, 10, 13] as const;
  const mids = [5, 8, 11, 14] as const;
  const tips = [6, 9, 12, 15] as const;
  const phases = [0, Math.PI, Math.PI * 1.12, Math.PI * 0.12] as const;

  for (let limbIndex = 0; limbIndex < 4; limbIndex += 1) {
    const front = limbIndex < 2;
    const side = limbIndex % 2 === 0 ? 1 : -1;
    const phase = cycle + phases[limbIndex];
    const rootX = front ? 0.29 : -0.23;
    const stride = Math.sin(phase) * (0.19 + speed * 0.07);
    const swingLift = Math.pow(Math.max(Math.sin(phase), 0), 1.5) *
      (0.08 + speed * 0.04);
    scratch.root.set(rootX, 0.56 + bound + leapLift, side * 0.23);
    scratch.tip.set(
      rootX + stride - tuck * (front ? 0.13 : -0.08),
      0.025 + swingLift + leapLift + tuck * 0.2,
      side * (0.25 - tuck * 0.04),
    );
    scratch.bend.set(front ? -0.28 : 0.34, -0.08, side * 0.16);
    solveLimb(
      target,
      roots[limbIndex],
      mids[limbIndex],
      tips[limbIndex],
      scratch.root,
      scratch.tip,
      front ? 0.31 : 0.35,
      front ? 0.31 : 0.35,
      scratch.bend,
      scratch.direction,
      scratch.perpendicular,
    );
  }
}

type PoseScratch = {
  biped: Float32Array;
  quadruped: Float32Array;
  root: THREE.Vector3;
  tip: THREE.Vector3;
  bend: THREE.Vector3;
  direction: THREE.Vector3;
  perpendicular: THREE.Vector3;
};

export function createNeoformPoseSampler() {
  const scratch: PoseScratch = {
    biped: new Float32Array(NEOFORM_JOINT_COUNT * 3),
    quadruped: new Float32Array(NEOFORM_JOINT_COUNT * 3),
    root: new THREE.Vector3(),
    tip: new THREE.Vector3(),
    bend: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    perpendicular: new THREE.Vector3(),
  };

  return (
    input: NeoformPoseInput,
    target = new Float32Array(NEOFORM_JOINT_COUNT * 3),
  ) => {
    const formBlend = smoothstep(0, 1, input.formBlend);
    if (formBlend <= 0.002) {
      sampleBiped(input, target, scratch);
      return target;
    }
    if (formBlend >= 0.998) {
      sampleQuadruped(input, target, scratch);
      return target;
    }
    sampleBiped(input, scratch.biped, scratch);
    sampleQuadruped(input, scratch.quadruped, scratch);
    for (let index = 0; index < target.length; index += 1) {
      target[index] = THREE.MathUtils.lerp(
        scratch.biped[index],
        scratch.quadruped[index],
        formBlend,
      );
    }
    return target;
  };
}

export function sampleNeoformPose(input: NeoformPoseInput) {
  return createNeoformPoseSampler()(input);
}

const COOL_SPECTRAL_PALETTE = [
  new THREE.Color("#ff2a87"),
  new THREE.Color("#9a28ff"),
  new THREE.Color("#4e38ff"),
  new THREE.Color("#087cff"),
  new THREE.Color("#29d7ff"),
  new THREE.Color("#899dff"),
];

function coolSpectralColor(time: number, offset: number, output: THREE.Color) {
  const phase = ((time * 0.16 + offset) % COOL_SPECTRAL_PALETTE.length +
    COOL_SPECTRAL_PALETTE.length) % COOL_SPECTRAL_PALETTE.length;
  const index = Math.floor(phase);
  const blend = phase - index;
  return output.lerpColors(
    COOL_SPECTRAL_PALETTE[index],
    COOL_SPECTRAL_PALETTE[(index + 1) % COOL_SPECTRAL_PALETTE.length],
    blend * blend * (3 - 2 * blend),
  );
}

function createRigMaterial(opacity: number, wireframe: boolean) {
  return new THREE.MeshBasicMaterial({
    color: 0x8d54ff,
    transparent: true,
    opacity,
    wireframe,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
}

type RigLayer = {
  group: THREE.Group;
  bones: THREE.InstancedMesh;
  joints: THREE.InstancedMesh;
  boneMaterial: THREE.MeshBasicMaterial;
  jointMaterial: THREE.MeshBasicMaterial;
};

const PLATE_JOINTS = [0, 1, 2, 3, 16, 18] as const;

function createRigLayer(
  boneGeometry: THREE.BufferGeometry,
  jointGeometry: THREE.BufferGeometry,
  opacity: number,
  wireframe: boolean,
) {
  const boneMaterial = createRigMaterial(opacity, wireframe);
  const jointMaterial = createRigMaterial(opacity * 0.88, true);
  const bones = new THREE.InstancedMesh(boneGeometry, boneMaterial, BONE_PAIRS.length);
  const joints = new THREE.InstancedMesh(jointGeometry, jointMaterial, NEOFORM_JOINT_COUNT);
  bones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  joints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bones.frustumCulled = false;
  joints.frustumCulled = false;
  const group = new THREE.Group();
  group.add(bones, joints);
  return { group, bones, joints, boneMaterial, jointMaterial } satisfies RigLayer;
}

export function createNeoformRig(compact: boolean) {
  const boneGeometry = new THREE.CylinderGeometry(0.055, 0.045, 1, compact ? 4 : 6, 1);
  const jointGeometry = compact
    ? new THREE.OctahedronGeometry(0.075, 0)
    : new THREE.IcosahedronGeometry(0.075, 0);
  const current = createRigLayer(boneGeometry, jointGeometry, 0.72, false);
  const past = createRigLayer(boneGeometry, jointGeometry, 0.13, true);
  const future = createRigLayer(boneGeometry, jointGeometry, 0.1, true);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xbaf628,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const coreGeometry = new THREE.OctahedronGeometry(0.13, 0);
  const tipGlowGeometry = new THREE.IcosahedronGeometry(0.09, 0);
  const tipGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xf5f3ea,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const tipGlows = new THREE.InstancedMesh(
    tipGlowGeometry,
    tipGlowMaterial,
    TIP_INDICES.length,
  );
  tipGlows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tipGlows.frustumCulled = false;
  const plateGeometry = new THREE.TetrahedronGeometry(0.17, 0);
  const plateMaterial = createRigMaterial(0.3, false);
  const plates = new THREE.InstancedMesh(
    plateGeometry,
    plateMaterial,
    PLATE_JOINTS.length,
  );
  plates.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plates.frustumCulled = false;
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  const coreHaloMaterial = coreMaterial.clone();
  coreHaloMaterial.opacity = 0.18;
  const coreHalo = new THREE.Mesh(coreGeometry, coreHaloMaterial);
  coreHalo.scale.setScalar(1.75);
  const group = new THREE.Group();
  group.add(past.group, future.group, current.group, plates, tipGlows, coreHalo, core);

  const samplePose = createNeoformPoseSampler();
  const currentPose = new Float32Array(NEOFORM_JOINT_COUNT * 3);
  const pastPose = new Float32Array(NEOFORM_JOINT_COUNT * 3);
  const futurePose = new Float32Array(NEOFORM_JOINT_COUNT * 3);
  const segmentStart = new THREE.Vector3();
  const segmentEnd = new THREE.Vector3();
  const midpoint = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const identityQuaternion = new THREE.Quaternion();
  const plateRotation = new THREE.Euler();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  const signalColor = new THREE.Color("#baf628");
  const tipPositions = TIP_INDICES.map(() => new THREE.Vector3());
  const corePosition = new THREE.Vector3();
  let predictionTick = 0;
  let predictionsWereVisible = false;

  const updateLayer = (
    layer: RigLayer,
    pose: Float32Array,
    signalProgress: ArrayLike<number>,
    signalVariation: ArrayLike<number>,
    renderTime: number,
  ) => {
    for (let boneIndex = 0; boneIndex < BONE_PAIRS.length; boneIndex += 1) {
      const [startIndex, endIndex, route] = BONE_PAIRS[boneIndex];
      getJoint(pose, startIndex, segmentStart);
      getJoint(pose, endIndex, segmentEnd);
      midpoint.copy(segmentStart).add(segmentEnd).multiplyScalar(0.5);
      direction.copy(segmentEnd).sub(segmentStart);
      const length = Math.max(direction.length(), 0.001);
      quaternion.setFromUnitVectors(up, direction.normalize());
      scale.set(1, length, 1);
      matrix.compose(midpoint, quaternion, scale);
      layer.bones.setMatrixAt(boneIndex, matrix);

      let signal = 0;
      for (let signalIndex = 0; signalIndex < signalProgress.length; signalIndex += 1) {
        const progress = signalProgress[signalIndex];
        if (progress >= 1.7) continue;
        const travel = signalTravelRate(signalIndex, boneIndex, signalVariation);
        const head = (progress - 0.06) * travel;
        signal = Math.max(signal, 1 - smoothstep(0.02, 0.16, Math.abs(route - head)));
      }
      coolSpectralColor(renderTime, boneIndex * 0.11, color);
      layer.bones.setColorAt(boneIndex, color.lerp(signalColor, signal * 0.92));
    }

    for (let jointIndex = 0; jointIndex < NEOFORM_JOINT_COUNT; jointIndex += 1) {
      getJoint(pose, jointIndex, midpoint);
      const jointScale = jointIndex === 3 || jointIndex === 18 ? 1.18 :
        TIP_INDICES.includes(jointIndex as (typeof TIP_INDICES)[number]) ? 0.82 : 1;
      matrix.compose(midpoint, identityQuaternion, scale.setScalar(jointScale));
      layer.joints.setMatrixAt(jointIndex, matrix);
    }
    layer.bones.instanceMatrix.needsUpdate = true;
    layer.joints.instanceMatrix.needsUpdate = true;
    if (layer.bones.instanceColor) layer.bones.instanceColor.needsUpdate = true;
  };

  const update = (input: NeoformRigUpdate) => {
    const sampleTime = input.reducedMotion ? 0.8 : input.time;
    const speed = input.reducedMotion ? 0.45 : input.speed;
    const leap = input.reducedMotion ? 0 : input.leap;
    const poseInput = { ...input, time: sampleTime, speed, leap };
    samplePose(poseInput, currentPose);
    updateLayer(current, currentPose, input.signalProgress, input.signalVariation, sampleTime);
    const predictionsVisible = input.predictionStrength > 0.02 && !input.reducedMotion;
    if (predictionsVisible && (!predictionsWereVisible || predictionTick % 2 === 0)) {
      samplePose({ ...poseInput, time: sampleTime - 0.15 }, pastPose);
      samplePose({ ...poseInput, time: sampleTime + 0.17 }, futurePose);
      updateLayer(past, pastPose, input.signalProgress, input.signalVariation, sampleTime);
      updateLayer(future, futurePose, input.signalProgress, input.signalVariation, sampleTime);
    }
    predictionTick += 1;
    predictionsWereVisible = predictionsVisible;
    past.group.visible = predictionsVisible;
    future.group.visible = predictionsVisible;
    past.boneMaterial.opacity = 0.13 * input.predictionStrength;
    past.jointMaterial.opacity = 0.1 * input.predictionStrength;
    future.boneMaterial.opacity = 0.1 * input.predictionStrength;
    future.jointMaterial.opacity = 0.08 * input.predictionStrength;
    const assembly = THREE.MathUtils.clamp(input.assembly, 0.12, 1);
    current.bones.count = Math.max(3, Math.round(BONE_PAIRS.length * assembly));
    current.joints.count = Math.max(4, Math.round(NEOFORM_JOINT_COUNT * assembly));
    plates.count = Math.max(1, Math.round(PLATE_JOINTS.length * assembly));
    current.boneMaterial.opacity = 0.42 + assembly * 0.3;
    current.jointMaterial.opacity = 0.36 + assembly * 0.28;
    plateMaterial.opacity = 0.12 + assembly * 0.2;

    PLATE_JOINTS.forEach((joint, index) => {
      getJoint(currentPose, joint, midpoint);
      const plateScale = index === 2 ? 1.45 : index === 0 ? 1.22 : 0.82;
      quaternion.setFromEuler(plateRotation.set(
        sampleTime * 0.06 + index * 0.37,
        sampleTime * 0.09 + index * 0.61,
        index * 0.28,
      ));
      matrix.compose(
        midpoint,
        quaternion,
        scale.set(plateScale, plateScale * 0.72, plateScale * 0.58),
      );
      plates.setMatrixAt(index, matrix);
    });
    plates.instanceMatrix.needsUpdate = true;

    getJoint(currentPose, NEOFORM_JOINTS.core, corePosition);
    core.position.copy(corePosition);
    coreHalo.position.copy(corePosition);
    const corePulse = 1 + Math.sin(sampleTime * 2.1) * 0.08;
    core.scale.setScalar(corePulse);
    coreHalo.scale.setScalar(1.72 + Math.sin(sampleTime * 1.45) * 0.14);
    TIP_INDICES.forEach((joint, index) => getJoint(currentPose, joint, tipPositions[index]));
    let anyArrival = 0;
    TIP_INDICES.forEach((_joint, tipIndex) => {
      let arrival = 0;
      for (let signalIndex = 0; signalIndex < input.signalProgress.length; signalIndex += 1) {
        const progress = input.signalProgress[signalIndex];
        if (progress >= 1.7) continue;
        const travel = signalTravelRate(
          signalIndex,
          tipIndex,
          input.signalVariation,
        );
        const head = (progress - 0.06) * travel;
        const reach = smoothstep(0.82, 1.0, head);
        const dissolve = 1 - smoothstep(1.05, 1.72, head);
        arrival = Math.max(arrival, reach * dissolve);
      }
      anyArrival = Math.max(anyArrival, arrival);
      matrix.compose(
        tipPositions[tipIndex],
        identityQuaternion,
        scale.setScalar(0.18 + arrival * 1.35),
      );
      tipGlows.setMatrixAt(tipIndex, matrix);
    });
    tipGlows.visible = anyArrival > 0.01;
    tipGlows.instanceMatrix.needsUpdate = true;
  };

  const dispose = () => {
    group.removeFromParent();
    boneGeometry.dispose();
    jointGeometry.dispose();
    coreGeometry.dispose();
    tipGlowGeometry.dispose();
    plateGeometry.dispose();
    [current, past, future].forEach((layer) => {
      layer.boneMaterial.dispose();
      layer.jointMaterial.dispose();
    });
    coreMaterial.dispose();
    coreHaloMaterial.dispose();
    tipGlowMaterial.dispose();
    plateMaterial.dispose();
  };

  return {
    group,
    update,
    dispose,
    currentPose,
    tipPositions,
    corePosition,
  };
}
