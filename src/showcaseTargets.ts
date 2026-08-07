export const SHOWCASE_ACT_COUNT = 4;
export const SHOWCASE_DESKTOP_CELLS = 6144;
export const SHOWCASE_COMPACT_CELLS = 2048;

export type ShowcaseTarget = {
  positionScale: Float32Array;
  normal: Float32Array;
  kind: Float32Array;
  route: Float32Array;
};

export type ShowcaseTargetAtlas = {
  count: number;
  targets: readonly ShowcaseTarget[];
  seed: Float32Array;
};

type Point = {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  scale: number;
  kind: number;
  route: number;
};

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const fract = (value: number) => value - Math.floor(value);
const hash = (index: number, channel: number) =>
  fract(Math.sin(index * 127.13 + channel * 311.71) * 43758.5453123);

function normalize(x: number, y: number, z: number) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length] as const;
}

function boxPoint(
  index: number,
  channel: number,
  center: readonly [number, number, number],
  size: readonly [number, number, number],
  kind: number,
  route: number,
  scale = 0.045,
): Point {
  const face = Math.floor(hash(index, channel) * 6);
  const u = hash(index, channel + 1) - 0.5;
  const v = hash(index, channel + 2) - 0.5;
  let x = u * size[0];
  let y = v * size[1];
  let z = (face % 2 ? -0.5 : 0.5) * size[2];
  let nx = 0;
  let ny = 0;
  let nz = face % 2 ? -1 : 1;
  if (face >= 2 && face < 4) {
    x = u * size[0];
    y = (face % 2 ? -0.5 : 0.5) * size[1];
    z = v * size[2];
    ny = face % 2 ? -1 : 1;
    nz = 0;
  } else if (face >= 4) {
    x = (face % 2 ? -0.5 : 0.5) * size[0];
    y = u * size[1];
    z = v * size[2];
    nx = face % 2 ? -1 : 1;
    nz = 0;
  }
  return {
    x: center[0] + x,
    y: center[1] + y,
    z: center[2] + z,
    nx,
    ny,
    nz,
    scale: scale * (0.72 + hash(index, channel + 3) * 0.5),
    kind,
    route,
  };
}

function spherePoint(
  index: number,
  channel: number,
  center: readonly [number, number, number],
  radius: number,
  kind: number,
  route: number,
  scale = 0.04,
): Point {
  const longitude = hash(index, channel) * TAU;
  const latitude = Math.acos(1 - hash(index, channel + 1) * 2);
  const nx = Math.sin(latitude) * Math.cos(longitude);
  const ny = Math.cos(latitude);
  const nz = Math.sin(latitude) * Math.sin(longitude);
  return {
    x: center[0] + nx * radius,
    y: center[1] + ny * radius,
    z: center[2] + nz * radius,
    nx,
    ny,
    nz,
    scale: scale * (0.74 + hash(index, channel + 2) * 0.52),
    kind,
    route,
  };
}

function segmentPoint(
  index: number,
  channel: number,
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  radius: number,
  kind: number,
  routeStart: number,
  routeEnd: number,
  scale = 0.038,
): Point {
  const along = hash(index, channel);
  const angle = hash(index, channel + 1) * TAU;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const [ax, ay, az] = normalize(dx, dy, dz);
  const up = Math.abs(ay) > 0.84 ? [1, 0, 0] : [0, 1, 0];
  const [tx, ty, tz] = normalize(
    ay * up[2] - az * up[1],
    az * up[0] - ax * up[2],
    ax * up[1] - ay * up[0],
  );
  const bx = ay * tz - az * ty;
  const by = az * tx - ax * tz;
  const bz = ax * ty - ay * tx;
  const radialX = tx * Math.cos(angle) + bx * Math.sin(angle);
  const radialY = ty * Math.cos(angle) + by * Math.sin(angle);
  const radialZ = tz * Math.cos(angle) + bz * Math.sin(angle);
  return {
    x: start[0] + dx * along + radialX * radius,
    y: start[1] + dy * along + radialY * radius,
    z: start[2] + dz * along + radialZ * radius,
    nx: radialX,
    ny: radialY,
    nz: radialZ,
    scale: scale * (0.76 + hash(index, channel + 2) * 0.45),
    kind,
    route: routeStart + (routeEnd - routeStart) * along,
  };
}

function torusPoint(
  index: number,
  channel: number,
  center: readonly [number, number, number],
  radius: number,
  tube: number,
  kind: number,
  route: number,
): Point {
  const around = hash(index, channel) * TAU;
  const cross = hash(index, channel + 1) * TAU;
  const ring = radius + Math.cos(cross) * tube;
  const nx = Math.cos(around) * Math.cos(cross);
  const ny = Math.sin(around) * Math.cos(cross);
  const nz = Math.sin(cross);
  return {
    x: center[0] + Math.cos(around) * ring,
    y: center[1] + Math.sin(around) * ring,
    z: center[2] + Math.sin(cross) * tube,
    nx,
    ny,
    nz,
    scale: 0.032 + hash(index, channel + 2) * 0.018,
    kind,
    route,
  };
}

function carTarget(index: number, count: number): Point {
  const t = (index + 0.5) / count;
  if (t < 0.22) {
    const x = -2.4 + hash(index, 10) * 4.8;
    const centerZ = Math.sin(x * 0.86) * 0.34;
    const across = hash(index, 11) - 0.5;
    return {
      x,
      y: -0.63 + Math.sin(x * 1.7) * 0.025,
      z: centerZ + across * 0.72,
      nx: 0,
      ny: 1,
      nz: 0,
      scale: 0.035 + hash(index, 12) * 0.035,
      kind: 0,
      route: clamp01((x + 2.4) / 4.8),
    };
  }
  if (t < 0.64) {
    const component = Math.floor(hash(index, 13) * 4);
    if (component === 0) return boxPoint(index, 20, [0, -0.1, 0], [1.72, 0.3, 0.76], 1, 0.48, 0.05);
    if (component === 1) return boxPoint(index, 24, [-0.2, 0.18, 0], [0.82, 0.42, 0.62], 1, 0.55, 0.048);
    if (component === 2) return boxPoint(index, 28, [0.58, 0.02, 0], [0.62, 0.22, 0.68], 1, 0.72, 0.043);
    return boxPoint(index, 32, [-0.72, 0.02, 0], [0.38, 0.22, 0.7], 1, 0.32, 0.04);
  }
  if (t < 0.84) {
    const wheel = Math.floor(hash(index, 35) * 4);
    const x = wheel < 2 ? -0.57 : 0.57;
    const z = wheel % 2 ? -0.43 : 0.43;
    return torusPoint(index, 36, [x, -0.28, z], 0.18, 0.055, 2, x > 0 ? 0.72 : 0.28);
  }
  if (t < 0.94) {
    return boxPoint(index, 40, [-0.12, 0.22, 0], [0.68, 0.28, 0.58], 3, 0.55, 0.036);
  }
  const side = hash(index, 44) > 0.5 ? 1 : -1;
  return boxPoint(index, 45, [0.89, 0.02, side * 0.24], [0.08, 0.08, 0.16], 4, 0.96, 0.026);
}

type Limb = readonly [readonly [number, number, number], readonly [number, number, number]];

const NINJA_LEFT_LIMBS: readonly Limb[] = [
  [[-0.62, 0.2, 0], [-0.68, 0.64, 0]],
  [[-0.66, 0.54, 0], [-0.88, 0.25, 0.08]],
  [[-0.88, 0.25, 0.08], [-0.7, -0.04, 0.12]],
  [[-0.6, 0.2, 0], [-0.82, -0.2, 0.12]],
  [[-0.82, -0.2, 0.12], [-1.02, -0.55, 0.18]],
  [[-0.58, 0.2, 0], [-0.28, -0.16, -0.08]],
  [[-0.28, -0.16, -0.08], [-0.05, -0.55, -0.14]],
  [[-0.62, 0.56, 0], [-0.28, 0.36, 0.02]],
  [[-0.28, 0.36, 0.02], [-0.02, 0.12, 0.04]],
];

const NINJA_RIGHT_LIMBS: readonly Limb[] = NINJA_LEFT_LIMBS.map(([start, end]) => [
  [-start[0], start[1], -start[2]],
  [-end[0], end[1], -end[2]],
]);

function ninjaTarget(index: number, count: number): Point {
  const t = (index + 0.5) / count;
  if (t < 0.09) {
    const angle = hash(index, 50) * TAU;
    const radius = Math.sqrt(hash(index, 51)) * 1.42;
    return {
      x: Math.cos(angle) * radius,
      y: -0.58,
      z: Math.sin(angle) * radius * 0.5,
      nx: 0,
      ny: 1,
      nz: 0,
      scale: 0.025 + hash(index, 52) * 0.026,
      kind: 0,
      route: radius / 1.42,
    };
  }
  const right = t >= 0.5;
  const localT = right ? (t - 0.5) / 0.5 : (t - 0.09) / 0.41;
  const limbs = right ? NINJA_RIGHT_LIMBS : NINJA_LEFT_LIMBS;
  const bodyKind = right ? 2 : 1;
  if (localT < 0.13) {
    return spherePoint(index, 54, [right ? 0.63 : -0.63, 0.79, 0], 0.17, bodyKind, 0.55, 0.034);
  }
  if (localT < 0.72) {
    const limb = limbs[Math.min(limbs.length - 1, Math.floor(hash(index, 57) * limbs.length))];
    return segmentPoint(index, 58, limb[0], limb[1], 0.075, bodyKind, 0.12, 0.82, 0.038);
  }
  if (localT < 0.86) {
    return boxPoint(
      index,
      62,
      [right ? 0.64 : -0.64, 0.42, right ? -0.02 : 0.02],
      [0.34, 0.5, 0.23],
      bodyKind,
      0.5,
      0.04,
    );
  }
  const swordStart: readonly [number, number, number] = right
    ? [0.33, 0.26, -0.03]
    : [-0.33, 0.26, 0.03];
  const swordEnd: readonly [number, number, number] = right
    ? [-0.05, 0.92, -0.03]
    : [0.05, 0.92, 0.03];
  return segmentPoint(index, 66, swordStart, swordEnd, 0.024, right ? 4 : 3, 0.62, 1, 0.025);
}

function islandTarget(index: number, count: number): Point {
  const t = (index + 0.5) / count;
  const angle = hash(index, 70) * TAU;
  const radius = Math.sqrt(hash(index, 71));
  const x = Math.cos(angle) * radius * 1.58;
  const z = Math.sin(angle) * radius * 1.02;
  const distance = Math.hypot(x / 1.58, z / 1.02);
  const height = 0.12 + (1 - distance) * 0.22 +
    Math.sin(x * 3.2 + z * 2.4) * 0.055;
  if (t < 0.49) {
    return {
      x,
      y: Math.round(height * 8) / 8,
      z,
      nx: -Math.cos(x * 3.2) * 0.18,
      ny: 1,
      nz: -Math.cos(z * 2.4) * 0.14,
      scale: 0.035 + hash(index, 72) * 0.04,
      kind: 0,
      route: clamp01((x / 1.58 + 1) * 0.5),
    };
  }
  if (t < 0.69) {
    const depth = hash(index, 73) * (0.68 + (1 - distance) * 0.34);
    const [nx, ny, nz] = normalize(x * 0.45, -0.55, z * 0.45);
    return {
      x: x * (1 - depth * 0.22),
      y: height - 0.08 - depth,
      z: z * (1 - depth * 0.22),
      nx,
      ny,
      nz,
      scale: 0.035 + hash(index, 74) * 0.045,
      kind: 1,
      route: depth,
    };
  }
  if (t < 0.79) {
    const riverX = -1.34 + hash(index, 75) * 2.68;
    const riverZ = Math.sin(riverX * 1.7) * 0.14 + (hash(index, 76) - 0.5) * 0.1;
    return {
      x: riverX,
      y: 0.17,
      z: riverZ,
      nx: 0,
      ny: 1,
      nz: 0,
      scale: 0.024 + hash(index, 77) * 0.026,
      kind: 2,
      route: clamp01((riverX + 1.34) / 2.68),
    };
  }
  if (t < 0.95) {
    const propX = (hash(index, 78) - 0.5) * 2.45;
    const propZ = (hash(index, 79) - 0.5) * 1.48;
    const propHeight = 0.12 + hash(index, 80) * 0.48;
    return segmentPoint(
      index,
      81,
      [propX, 0.22, propZ],
      [propX + (hash(index, 82) - 0.5) * 0.08, 0.22 + propHeight, propZ],
      0.035 + hash(index, 83) * 0.04,
      3,
      0.12,
      0.9,
      0.029,
    );
  }
  const ruinX = hash(index, 84) > 0.5 ? 0.72 : 0.2;
  return boxPoint(index, 85, [ruinX, 0.38, -0.34], [0.34, 0.5, 0.28], 4, 0.86, 0.034);
}

function cosmicTarget(index: number, count: number): Point {
  const t = (index + 0.5) / count;
  if (t < 0.32) return spherePoint(index, 90, [0, 0.05, 0], 0.7, t < 0.22 ? 0 : 1, t / 0.32, 0.034);
  if (t < 0.48) {
    const angle = hash(index, 94) * TAU;
    const radius = 0.92 + hash(index, 95) * 1.02;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle * 2.3 + hash(index, 96)) * 0.08,
      z: Math.sin(angle) * radius * 0.56,
      nx: 0,
      ny: 1,
      nz: 0,
      scale: 0.018 + hash(index, 97) * 0.022,
      kind: 2,
      route: clamp01((radius - 0.92) / 1.02),
    };
  }
  if (t < 0.57) {
    const planet = Math.floor(hash(index, 98) * 5);
    const orbit = 0.95 + planet * 0.28;
    const angle = planet * 1.41 + hash(index, 99) * 0.24;
    return spherePoint(
      index,
      100,
      [Math.cos(angle) * orbit, 0.02, Math.sin(angle) * orbit * 0.56],
      0.055 + planet * 0.012,
      3,
      planet / 4,
      0.024,
    );
  }
  const arm = hash(index, 104) > 0.5 ? 1 : -1;
  const radial = Math.pow(hash(index, 105), 0.62) * 2.35;
  const angle = arm * radial * 2.7 + hash(index, 106) * 0.55;
  const thickness = (hash(index, 107) - 0.5) * (0.06 + radial * 0.025);
  return {
    x: Math.cos(angle) * radial,
    y: thickness,
    z: Math.sin(angle) * radial * 0.58,
    nx: 0,
    ny: 1,
    nz: 0,
    scale: 0.012 + hash(index, 108) * 0.025,
    kind: 4,
    route: clamp01(radial / 2.35),
  };
}

const targetFactories = [carTarget, ninjaTarget, islandTarget, cosmicTarget] as const;

export function createShowcaseTargetAtlas(count: number): ShowcaseTargetAtlas {
  if (!Number.isInteger(count) || count < 128) {
    throw new RangeError("showcase target count must be an integer of at least 128");
  }
  const seed = new Float32Array(count);
  const targets = targetFactories.map((factory) => ({
    positionScale: new Float32Array(count * 4),
    normal: new Float32Array(count * 3),
    kind: new Float32Array(count),
    route: new Float32Array(count),
  }));

  for (let index = 0; index < count; index += 1) {
    seed[index] = hash(index, 0);
    targetFactories.forEach((factory, targetIndex) => {
      const point = factory(index, count);
      const positionOffset = index * 4;
      const normalOffset = index * 3;
      targets[targetIndex].positionScale.set(
        [point.x, point.y, point.z, point.scale],
        positionOffset,
      );
      const [nx, ny, nz] = normalize(point.nx, point.ny, point.nz);
      targets[targetIndex].normal.set([nx, ny, nz], normalOffset);
      targets[targetIndex].kind[index] = point.kind;
      targets[targetIndex].route[index] = clamp01(point.route);
    });
  }
  return { count, targets, seed };
}
