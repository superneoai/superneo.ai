import * as THREE from "three";

export const DESKTOP_SWARM_COUNT = 700;
export const COMPACT_SWARM_COUNT = 260;

export type BiomeInstance = {
  ground: [number, number, number];
  swarm: [number, number, number];
  scale: [number, number, number];
  seed: number;
  kind: number;
};

export type NeoformWorldUpdate = {
  time: number;
  phase: number;
  speed: number;
  bloom: number;
  pointer: THREE.Vector3;
  pointerStrength: number;
  signalProgress: ArrayLike<number>;
  contacts: ReadonlyArray<THREE.Vector3>;
  reducedMotion: boolean;
};

const fract = (value: number) => value - Math.floor(value);
const hash = (index: number, channel: number) =>
  fract(Math.sin(index * 91.733 + channel * 47.117) * 43758.5453);

export function createBiomeInstances(count: number): BiomeInstance[] {
  const instances: BiomeInstance[] = [];
  const columns = Math.ceil(Math.sqrt(count * 1.65));
  const rows = Math.ceil(count / columns);

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const seed = hash(index, 0);
    const kind = hash(index, 1);
    const jitterX = (hash(index, 2) - 0.5) * 0.14;
    const jitterZ = (hash(index, 3) - 0.5) * 0.16;
    const groundX = (column / Math.max(columns - 1, 1) - 0.5) * 5.2 + jitterX;
    const groundZ = (row / Math.max(rows - 1, 1) - 0.5) * 2.9 + jitterZ;
    const dune = Math.sin(groundX * 1.7 + seed * 4) * 0.045 +
      Math.cos(groundZ * 2.3 - seed * 3) * 0.035;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const orbitAngle = index * goldenAngle + seed * 0.6;
    const orbitBand = 0.64 + Math.sqrt((index + 0.5) / count) * 1.72;
    const swarmY = 0.72 + (hash(index, 4) - 0.5) * 1.72;
    const terrainScale = 0.055 + hash(index, 5) * 0.055;
    const crystalHeight = 0.16 + hash(index, 6) * 0.36;
    const scale: [number, number, number] = kind < 0.56
      ? [terrainScale * 1.65, terrainScale * 0.38, terrainScale * 1.35]
      : kind < 0.84
        ? [terrainScale * 0.58, crystalHeight, terrainScale * 0.58]
        : [terrainScale * 0.34, terrainScale * 0.34, terrainScale * 0.34];

    instances.push({
      ground: [groundX, dune, groundZ],
      swarm: [
        Math.cos(orbitAngle) * orbitBand,
        swarmY,
        Math.sin(orbitAngle) * orbitBand * 0.72,
      ],
      scale,
      seed,
      kind,
    });
  }

  return instances;
}

const worldVertexShader = /* glsl */ `
  precision highp float;

  attribute vec3 aGroundPosition;
  attribute vec3 aSwarmTarget;
  attribute vec3 aInstanceScale;
  attribute float aSeed;
  attribute float aKind;

  uniform float uTime;
  uniform float uPhase;
  uniform float uSpeed;
  uniform float uBloom;
  uniform float uReducedMotion;
  uniform float uCompact;
  uniform vec3 uPointerWorld;
  uniform float uPointerStrength;
  uniform float uSignalProgress[5];
  uniform vec3 uPulseOrigins[5];
  uniform vec3 uContacts[4];

  varying float vSeed;
  varying float vKind;
  varying float vSignal;
  varying float vBloom;
  varying float vDepth;

  mat3 rotateX(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
  }

  mat3 rotateY(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
  }

  mat3 rotateZ(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
  }

  void main() {
    float activeTime = uTime * (1.0 - uReducedMotion);
    vec3 ground = aGroundPosition;
    float travel = activeTime * (0.16 + uSpeed * 0.13);
    ground.x = mod(ground.x - travel + 2.6, 5.2) - 2.6;
    float dune = sin(ground.x * 2.1 + aSeed * 5.0 + activeTime * 0.16) * 0.035 +
      cos(ground.z * 3.2 - activeTime * 0.12 + aSeed * 3.0) * 0.022;
    ground.y += dune;

    float biomeGrowth = smoothstep(0.0, 2.25, uPhase);
    float crystal = smoothstep(0.54, 0.86, aKind);
    vec3 instanceScale = aInstanceScale;
    instanceScale.y *= mix(0.24, 1.0, biomeGrowth + crystal * 0.18);

    vec3 swarm = aSwarmTarget;
    float orbit = activeTime * (0.13 + aSeed * 0.16);
    swarm = rotateY(orbit) * swarm;
    swarm.x += sin(activeTime * 0.41 + aSeed * 19.0) * 0.08;
    swarm.y += cos(activeTime * 0.33 + aSeed * 13.0) * 0.07;
    swarm.z += sin(activeTime * 0.28 + aSeed * 17.0) * 0.06;

    float bloom = smoothstep(0.02, 0.98, uBloom);
    instanceScale *= mix(1.0, mix(0.36, 0.52, uCompact), bloom);
    vec3 center = mix(ground, swarm, bloom);
    float pulseSignal = 0.0;
    for (int signalIndex = 0; signalIndex < 5; signalIndex++) {
      float progress = uSignalProgress[signalIndex];
      float radius = progress * 2.35;
      float distanceToPulse = length(center.xz - uPulseOrigins[signalIndex].xz);
      float ring = 1.0 - smoothstep(0.055, 0.17, abs(distanceToPulse - radius));
      float dissolve = 1.0 - smoothstep(1.08, 1.68, progress);
      pulseSignal = max(pulseSignal, ring * dissolve);
      center.y += ring * dissolve * mix(0.13, 0.24, bloom);
    }

    float footField = 0.0;
    for (int contactIndex = 0; contactIndex < 4; contactIndex++) {
      float planted = 1.0 - smoothstep(0.045, 0.19, uContacts[contactIndex].y);
      float distanceToFoot = length(center.xz - uContacts[contactIndex].xz);
      float ripple = sin(distanceToFoot * 18.0 - activeTime * 7.0) *
        exp(-distanceToFoot * 3.8) * planted;
      footField += ripple;
    }
    center.y += footField * 0.018 * (1.0 - bloom);

    vec3 pointerPosition = vec3(uPointerWorld.x, 0.0, -uPointerWorld.y * 0.72);
    vec3 pointerVector = center - pointerPosition;
    float pointerDistance = length(pointerVector);
    float pointerField = (1.0 - smoothstep(0.08, 0.78, pointerDistance)) *
      uPointerStrength;
    center += normalize(pointerVector + vec3(0.001)) * pointerField *
      mix(0.08, 0.34, bloom);

    float spin = aSeed * 6.28318 + activeTime * (0.08 + bloom * 0.72);
    vec3 transformed = position * instanceScale;
    transformed = rotateY(spin) * rotateX(spin * (0.28 + bloom * 0.52)) * transformed;
    transformed = rotateZ(bloom * sin(activeTime * 0.37 + aSeed * 9.0)) * transformed;
    transformed += center;

    vSeed = aSeed;
    vKind = aKind;
    vSignal = clamp(pulseSignal + pointerField * 0.24, 0.0, 1.0);
    vBloom = bloom;
    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    vDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const worldFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uSignalColor;
  uniform float uTime;

  varying float vSeed;
  varying float vKind;
  varying float vSignal;
  varying float vBloom;
  varying float vDepth;

  float bayer4(vec2 cell) {
    float x = mod(floor(cell.x), 4.0);
    float y = mod(floor(cell.y), 4.0);
    return mod(x * 2.0 + y * 3.0 + x * y, 16.0) / 16.0;
  }

  void main() {
    float threshold = bayer4(gl_FragCoord.xy);
    float pulse = 0.5 + 0.5 * sin(uTime * 0.24 + vSeed * 19.0);
    vec3 bone = vec3(0.91, 0.898, 0.863);
    vec3 violet = vec3(0.46, 0.08, 1.0);
    vec3 electricBlue = vec3(0.02, 0.48, 1.0);
    vec3 ice = vec3(0.18, 0.8, 1.0);
    vec3 spectral = mix(violet, electricBlue, smoothstep(0.18, 0.72, vSeed));
    spectral = mix(spectral, ice, smoothstep(0.74, 1.0, vSeed));
    vec3 color = mix(bone * (0.18 + threshold * 0.16), spectral, 0.62 + vBloom * 0.12);
    color *= 0.58 + pulse * 0.24;
    color = mix(color, uSignalColor, vSignal * 0.68);
    color += uSignalColor * vSignal * 0.16;
    float coverage = 0.18 + vKind * 0.24 + vBloom * 0.12 + vSignal * 0.42;
    if (coverage < threshold * 0.88) discard;
    float depthFade = 1.0 - smoothstep(4.4, 6.4, vDepth);
    gl_FragColor = vec4(
      color,
      (0.075 + vKind * 0.07 + vBloom * 0.055 + vSignal * 0.18) * depthFade
    );
  }
`;

export function createNeoformWorld(compact: boolean, signalColor: THREE.Color) {
  const count = compact ? COMPACT_SWARM_COUNT : DESKTOP_SWARM_COUNT;
  const instances = createBiomeInstances(count);
  const baseGeometry = new THREE.BufferGeometry();
  const shardVertices = new THREE.Float32BufferAttribute([
    0, 0.78, 0,
    -0.66, -0.42, 0.24,
    0.7, -0.38, -0.2,
  ], 3);
  baseGeometry.setAttribute("position", shardVertices);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = baseGeometry.index;
  Object.entries(baseGeometry.attributes).forEach(([name, attribute]) => {
    geometry.setAttribute(name, attribute);
  });
  geometry.instanceCount = count;

  const groundPositions = new Float32Array(count * 3);
  const swarmTargets = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const kinds = new Float32Array(count);
  instances.forEach((instance, index) => {
    groundPositions.set(instance.ground, index * 3);
    swarmTargets.set(instance.swarm, index * 3);
    scales.set(instance.scale, index * 3);
    seeds[index] = instance.seed;
    kinds[index] = instance.kind;
  });
  geometry.setAttribute("aGroundPosition", new THREE.InstancedBufferAttribute(groundPositions, 3));
  geometry.setAttribute("aSwarmTarget", new THREE.InstancedBufferAttribute(swarmTargets, 3));
  geometry.setAttribute("aInstanceScale", new THREE.InstancedBufferAttribute(scales, 3));
  geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
  geometry.setAttribute("aKind", new THREE.InstancedBufferAttribute(kinds, 1));

  const signalProgress = new Float32Array(5).fill(1.7);
  const pulseOrigins = Array.from({ length: 5 }, () => new THREE.Vector3(99, 0, 99));
  const contacts = Array.from({ length: 4 }, () => new THREE.Vector3(99, 99, 99));
  const uniforms = {
    uTime: { value: 0 },
    uPhase: { value: 0 },
    uSpeed: { value: 0.5 },
    uBloom: { value: 0 },
    uReducedMotion: { value: 0 },
    uCompact: { value: compact ? 1 : 0 },
    uPointerWorld: { value: new THREE.Vector3() },
    uPointerStrength: { value: 0 },
    uSignalProgress: { value: signalProgress },
    uPulseOrigins: { value: pulseOrigins },
    uContacts: { value: contacts },
    uSignalColor: { value: signalColor.clone() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: worldVertexShader,
    fragmentShader: worldFragmentShader,
    transparent: !compact,
    blending: compact ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: compact,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const shards = new THREE.Mesh(geometry, material);
  shards.frustumCulled = false;

  const groundGeometry = new THREE.PlaneGeometry(5.2, 2.9, compact ? 14 : 30, compact ? 8 : 18);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundMaterial = new THREE.MeshBasicMaterial({
    color: 0x7b67ff,
    transparent: true,
    opacity: compact ? 0.1 : 0.13,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.y = -0.012;
  const group = new THREE.Group();
  group.add(ground, shards);

  const triggerPulse = (index: number, pointer: THREE.Vector3) => {
    pulseOrigins[index].set(pointer.x, 0, -pointer.y * 0.72);
  };

  const update = (input: NeoformWorldUpdate) => {
    uniforms.uTime.value = input.reducedMotion ? 7 : input.time;
    uniforms.uPhase.value = input.phase;
    uniforms.uSpeed.value = input.speed;
    uniforms.uBloom.value = input.bloom;
    uniforms.uReducedMotion.value = input.reducedMotion ? 1 : 0;
    uniforms.uPointerWorld.value.copy(input.pointer);
    uniforms.uPointerStrength.value = input.pointerStrength;
    for (let index = 0; index < signalProgress.length; index += 1) {
      signalProgress[index] = input.signalProgress[index] ?? 1.7;
    }
    for (let index = 0; index < contacts.length; index += 1) {
      const contact = input.contacts[index];
      if (contact) contacts[index].copy(contact);
      else contacts[index].set(99, 99, 99);
    }
    groundMaterial.opacity = THREE.MathUtils.lerp(
      compact ? 0.1 : 0.13,
      0.015,
      input.bloom,
    );
  };

  const dispose = () => {
    group.removeFromParent();
    baseGeometry.dispose();
    geometry.dispose();
    material.dispose();
    groundGeometry.dispose();
    groundMaterial.dispose();
  };

  return { group, update, triggerPulse, dispose, count, pulseOrigins };
}
