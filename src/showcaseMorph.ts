import * as THREE from "three";
import {
  createShowcaseTargetAtlas,
  SHOWCASE_COMPACT_CELLS,
  SHOWCASE_DESKTOP_CELLS,
} from "./showcaseTargets.ts";

export type ShowcaseMorphUpdate = {
  time: number;
  fromAct: number;
  toAct: number;
  transition: number;
  actProgress: number;
  pointer: THREE.Vector3;
  pointerStrength: number;
  signalProgress: ArrayLike<number>;
  reducedMotion: boolean;
};

export const showcaseVertexShader = /* glsl */ `
  precision highp float;

  attribute vec4 aTarget0;
  attribute vec4 aTarget1;
  attribute vec4 aTarget2;
  attribute vec4 aTarget3;
  attribute vec3 aNormal0;
  attribute vec3 aNormal1;
  attribute vec3 aNormal2;
  attribute vec3 aNormal3;
  attribute vec4 aKinds;
  attribute vec4 aRoutes;
  attribute float aSeed;

  uniform float uTime;
  uniform float uFromAct;
  uniform float uToAct;
  uniform float uTransition;
  uniform float uActProgress;
  uniform float uReducedMotion;
  uniform vec3 uPointer;
  uniform float uPointerStrength;
  uniform float uSignalProgress[5];
  uniform vec3 uSignalColor;

  varying vec3 vColor;
  varying vec3 vNormal;
  varying float vSignal;
  varying float vMorph;
  varying float vSeed;
  varying float vKind;
  varying float vDepth;

  const float PI = 3.14159265359;
  const float TAU = 6.28318530718;

  float ease(float value) {
    value = clamp(value, 0.0, 1.0);
    return value * value * (3.0 - 2.0 * value);
  }

  mat2 rotate2d(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  vec4 targetData(float act) {
    if (act < 0.5) return aTarget0;
    if (act < 1.5) return aTarget1;
    if (act < 2.5) return aTarget2;
    return aTarget3;
  }

  vec3 targetNormal(float act) {
    if (act < 0.5) return aNormal0;
    if (act < 1.5) return aNormal1;
    if (act < 2.5) return aNormal2;
    return aNormal3;
  }

  float targetKind(float act) {
    if (act < 0.5) return aKinds.x;
    if (act < 1.5) return aKinds.y;
    if (act < 2.5) return aKinds.z;
    return aKinds.w;
  }

  float targetRoute(float act) {
    if (act < 0.5) return aRoutes.x;
    if (act < 1.5) return aRoutes.y;
    if (act < 2.5) return aRoutes.z;
    return aRoutes.w;
  }

  vec3 palette(float act, float kind, float seed) {
    vec3 bone = vec3(0.91, 0.898, 0.863);
    vec3 graphite = vec3(0.055, 0.06, 0.075);
    vec3 violet = vec3(0.47, 0.075, 1.0);
    vec3 blue = vec3(0.02, 0.44, 1.0);
    vec3 ice = vec3(0.18, 0.82, 1.0);
    vec3 pink = vec3(1.0, 0.08, 0.48);
    if (act < 0.5) {
      if (kind < 0.5) return mix(graphite, blue, 0.48);
      if (kind < 1.5) return mix(bone, violet, 0.12 + seed * 0.18);
      if (kind < 2.5) return graphite;
      if (kind < 3.5) return mix(violet, blue, seed);
      return ice;
    }
    if (act < 1.5) {
      if (kind < 0.5) return graphite;
      if (kind < 1.5) return bone;
      if (kind < 2.5) return mix(violet, blue, seed * 0.7);
      return mix(ice, bone, 0.34);
    }
    if (act < 2.5) {
      if (kind < 0.5) return mix(bone, violet, 0.16 + seed * 0.18);
      if (kind < 1.5) return mix(graphite, violet, 0.24);
      if (kind < 2.5) return mix(blue, ice, 0.58);
      if (kind < 3.5) return mix(violet, pink, seed * 0.46);
      return bone;
    }
    if (kind < 0.5) return mix(blue, ice, seed * 0.58);
    if (kind < 1.5) return mix(bone, blue, 0.22);
    if (kind < 2.5) return violet;
    if (kind < 3.5) return mix(pink, ice, seed);
    return mix(violet, blue, seed);
  }

  vec3 sphereOrigin(float seed) {
    float longitude = seed * TAU;
    float latitude = acos(1.0 - fract(seed * 17.31) * 2.0);
    return vec3(
      sin(latitude) * cos(longitude),
      cos(latitude),
      sin(latitude) * sin(longitude)
    ) * 0.7;
  }

  vec3 animateTarget(vec3 center, float act, float kind, float time, float progress) {
    float activeTime = time * (1.0 - uReducedMotion);
    if (act < 0.5) {
      if (kind < 0.5) {
        center.x = mod(center.x - activeTime * 0.42 + 2.4, 4.8) - 2.4;
        center.z += sin(center.x * 0.86) * 0.025;
      } else if (kind > 1.5 && kind < 2.5) {
        vec2 wheelCenter = vec2(sign(center.x) * 0.57, -0.28);
        center.xy = wheelCenter + rotate2d(-activeTime * 2.8) * (center.xy - wheelCenter);
      } else if (kind > 3.5) {
        center.x += 0.04 + sin(activeTime * 5.0 + aSeed * 9.0) * 0.018;
      }
    } else if (act < 1.5) {
      float side = center.x < 0.0 ? -1.0 : 1.0;
      float duel = sin(activeTime * 1.55 + side * 0.72);
      vec2 pivot = vec2(side * 0.63, 0.18);
      float bodyAngle = duel * 0.055 * -side;
      if (kind > 0.5) center.xy = pivot + rotate2d(bodyAngle) * (center.xy - pivot);
      if (kind > 2.5) {
        float strike = sin(activeTime * 1.55) * 0.12 * side;
        center.xy = vec2(side * 0.31, 0.26) +
          rotate2d(strike) * (center.xy - vec2(side * 0.31, 0.26));
      }
    } else if (act < 2.5) {
      if (kind > 1.5 && kind < 2.5) {
        center.y += sin(center.x * 4.0 - activeTime * 1.2 + aSeed * 6.0) * 0.025;
      } else if (kind > 2.5 && kind < 3.5) {
        center.x += sin(activeTime * 0.82 + aSeed * 11.0) * max(center.y - 0.18, 0.0) * 0.045;
      }
    } else {
      float cosmic = ease(progress);
      vec3 origin = sphereOrigin(aSeed);
      if (kind < 1.5) {
        float earthScale = mix(1.0, 0.28, ease((cosmic - 0.38) / 0.45));
        center *= earthScale;
      } else {
        center = mix(origin, center, ease((cosmic - 0.12) / 0.72));
      }
      float orbit = activeTime * mix(0.16, 0.035, cosmic);
      center.xz = rotate2d(orbit * (0.55 + aSeed * 0.45)) * center.xz;
    }
    return center;
  }

  void main() {
    float morph = ease(uTransition);
    vec4 fromData = targetData(uFromAct);
    vec4 toData = targetData(uToAct);
    float fromKind = targetKind(uFromAct);
    float toKind = targetKind(uToAct);
    float fromRoute = targetRoute(uFromAct);
    float toRoute = targetRoute(uToAct);
    vec3 fromCenter = animateTarget(fromData.xyz, uFromAct, fromKind, uTime, uActProgress);
    vec3 toCenter = animateTarget(toData.xyz, uToAct, toKind, uTime, uActProgress);
    vec3 travel = toCenter - fromCenter;
    vec3 perpendicular = normalize(vec3(-travel.z, 0.28 + aSeed * 0.22, travel.x) + 0.0001);
    float arc = sin(morph * PI) * (0.14 + length(travel) * 0.055) * (aSeed - 0.5);
    vec3 center = mix(fromCenter, toCenter, morph) + perpendicular * arc;
    vec3 normal = normalize(mix(targetNormal(uFromAct), targetNormal(uToAct), morph));
    float cellScale = mix(fromData.w, toData.w, morph) *
      (1.0 - sin(morph * PI) * 0.26);

    vec2 pointerDelta = center.xy - uPointer.xy;
    float pointerField = (1.0 - smoothstep(0.08, 0.72, length(pointerDelta))) *
      uPointerStrength;
    center += normalize(vec3(pointerDelta, 0.12) + 0.001) * pointerField * 0.08;

    float route = mix(fromRoute, toRoute, morph);
    float signal = 0.0;
    for (int index = 0; index < 5; index++) {
      float progress = uSignalProgress[index];
      float head = 1.0 - smoothstep(0.025, 0.12, abs(route - progress));
      float fade = 1.0 - smoothstep(1.02, 1.58, progress);
      signal = max(signal, head * fade);
    }

    vec3 tangent = normalize(cross(normal, abs(normal.y) > 0.86 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
    vec3 bitangent = normalize(cross(normal, tangent));
    vec3 local = position * cellScale;
    local.xy = rotate2d(aSeed * TAU + uTime * 0.04 * (1.0 - uReducedMotion)) * local.xy;
    vec3 transformed = center + tangent * local.x + normal * local.y + bitangent * local.z;

    vec3 fromColor = palette(uFromAct, fromKind, aSeed);
    vec3 toColor = palette(uToAct, toKind, aSeed);
    vColor = mix(fromColor, toColor, morph);
    vColor = mix(vColor, uSignalColor, signal * 0.92);
    vNormal = normalMatrix * normal;
    vSignal = signal;
    vMorph = sin(morph * PI);
    vSeed = aSeed;
    vKind = mix(fromKind, toKind, morph);
    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    vDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

export const showcaseFragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying vec3 vNormal;
  varying float vSignal;
  varying float vMorph;
  varying float vSeed;
  varying float vKind;
  varying float vDepth;

  float bayer4(vec2 cell) {
    float x = mod(floor(cell.x), 4.0);
    float y = mod(floor(cell.y), 4.0);
    return mod(x * 2.0 + y * 3.0 + x * y, 16.0) / 16.0;
  }

  void main() {
    float threshold = bayer4(gl_FragCoord.xy);
    if (vMorph > 0.22 && threshold > 1.02 - vMorph * 0.18) discard;
    vec3 normal = normalize(vNormal);
    vec3 lightDirection = normalize(vec3(-0.42, 0.82, 0.48));
    float diffuse = 0.34 + max(dot(normal, lightDirection), 0.0) * 0.72;
    float rim = pow(1.0 - abs(normal.z), 2.2);
    vec3 color = vColor * diffuse;
    color += vColor * rim * (0.18 + vMorph * 0.24);
    color += vec3(0.91, 0.898, 0.863) * threshold * 0.025;
    color += vSignal * vec3(0.52, 0.72, 0.12) * 0.42;
    float depthFade = 1.0 - smoothstep(6.0, 8.0, vDepth);
    gl_FragColor = vec4(color * depthFade, 1.0);
  }
`;

function makeGeometry(count: number) {
  const base = new THREE.TetrahedronGeometry(1, 0);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  for (const [name, attribute] of Object.entries(base.attributes)) {
    geometry.setAttribute(name, attribute);
  }
  const atlas = createShowcaseTargetAtlas(count);
  atlas.targets.forEach((target, index) => {
    geometry.setAttribute(
      `aTarget${index}`,
      new THREE.InstancedBufferAttribute(target.positionScale, 4),
    );
    geometry.setAttribute(
      `aNormal${index}`,
      new THREE.InstancedBufferAttribute(target.normal, 3),
    );
  });
  const kinds = new Float32Array(count * 4);
  const routes = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    for (let target = 0; target < atlas.targets.length; target += 1) {
      kinds[index * 4 + target] = atlas.targets[target].kind[index];
      routes[index * 4 + target] = atlas.targets[target].route[index];
    }
  }
  geometry.setAttribute("aKinds", new THREE.InstancedBufferAttribute(kinds, 4));
  geometry.setAttribute("aRoutes", new THREE.InstancedBufferAttribute(routes, 4));
  geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(atlas.seed, 1));
  geometry.instanceCount = count;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4.4);
  base.dispose();
  return geometry;
}

export function createShowcaseMorphSystem(compact: boolean, signalColor: THREE.Color) {
  const count = compact ? SHOWCASE_COMPACT_CELLS : SHOWCASE_DESKTOP_CELLS;
  const geometry = makeGeometry(count);
  const signalProgress = new Float32Array(5).fill(1.7);
  const uniforms = {
    uTime: { value: 0 },
    uFromAct: { value: 0 },
    uToAct: { value: 0 },
    uTransition: { value: 0 },
    uActProgress: { value: 0 },
    uReducedMotion: { value: 0 },
    uPointer: { value: new THREE.Vector3() },
    uPointerStrength: { value: 0 },
    uSignalProgress: { value: signalProgress },
    uSignalColor: { value: signalColor.clone() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: showcaseVertexShader,
    fragmentShader: showcaseFragmentShader,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  const group = new THREE.Group();
  group.add(mesh);

  const update = (input: ShowcaseMorphUpdate) => {
    uniforms.uTime.value = input.reducedMotion ? 6.4 : input.time;
    uniforms.uFromAct.value = THREE.MathUtils.clamp(input.fromAct, 0, 3);
    uniforms.uToAct.value = THREE.MathUtils.clamp(input.toAct, 0, 3);
    uniforms.uTransition.value = THREE.MathUtils.clamp(input.transition, 0, 1);
    uniforms.uActProgress.value = THREE.MathUtils.clamp(input.actProgress, 0, 1);
    uniforms.uReducedMotion.value = input.reducedMotion ? 1 : 0;
    uniforms.uPointer.value.copy(input.pointer);
    uniforms.uPointerStrength.value = input.pointerStrength;
    for (let index = 0; index < signalProgress.length; index += 1) {
      signalProgress[index] = input.signalProgress[index] ?? 1.7;
    }
  };

  const dispose = () => {
    group.removeFromParent();
    geometry.dispose();
    material.dispose();
  };

  return { group, mesh, material, update, dispose, count };
}
