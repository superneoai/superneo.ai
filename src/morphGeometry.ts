import * as THREE from "three";

function setVector(target: Float32Array, index: number, vector: THREE.Vector3) {
  const offset = index * 3;
  target[offset] = vector.x;
  target[offset + 1] = vector.y;
  target[offset + 2] = vector.z;
}

function samplePath(
  state: number,
  u: number,
  strand: number,
  mantaSpine: THREE.CatmullRomCurve3,
  target: THREE.Vector3,
) {
  const centered = u - 0.5;
  const strandOffset = strand - 1;
  if (state === 0) {
    const strandPhase = strand * Math.PI * 2 / 3;
    const angle = centered * Math.PI * 1.5 + strandPhase;
    const radius = 0.29 + Math.sin(u * Math.PI) * 0.15;
    return target.set(
      Math.cos(angle) * radius * 0.82,
      Math.sin(angle) * radius * 1.16,
      strandOffset * 0.11 + Math.cos(angle * 2 + strandPhase) * 0.075,
    );
  }
  if (state === 1) {
    if (strand === 2) {
      mantaSpine.getPointAt(u, target);
      target.x += Math.sin(u * Math.PI * 2) * 0.035;
      return target;
    }
    const wing = Math.pow(Math.max(Math.sin(u * Math.PI), 0), 0.68);
    const edgeDrop = Math.pow(Math.abs(centered) * 2, 1.6);
    const upperWing = strand === 0;
    return target.set(
      centered * (upperWing ? 3.04 : 2.84),
      upperWing
        ? 0.025 + wing * 0.25 - edgeDrop * 0.09
        : -0.05 - wing * 0.25 + edgeDrop * 0.06,
      upperWing
        ? wing * 0.19 + Math.sin(u * Math.PI * 2) * 0.035
        : -0.055 + wing * 0.11 - Math.sin(u * Math.PI * 2) * 0.025,
    );
  }
  if (state === 2) {
    if (strand === 2) {
      return target.set(
        Math.sin(u * Math.PI * 2) * 0.17,
        0.84 - u * 1.68,
        Math.sin(u * Math.PI) * 0.24,
      );
    }
    const aperture = Math.pow(Math.max(Math.sin(u * Math.PI), 0), 0.72);
    const upperLid = strand === 0;
    return target.set(
      centered * 1.86,
      (upperLid ? 1 : -1) * aperture * 0.64,
      (upperLid ? 0.13 : -0.045) + aperture * (upperLid ? 0.1 : 0.07),
    );
  }

  if (strand === 2) {
    return target.set(
      centered * 3.6,
      Math.sin(u * Math.PI * 2) * 0.095,
      0.08 + Math.sin(u * Math.PI) * 0.12,
    );
  }
  const upperGate = strand === 0;
  const gatewayAngle = upperGate
    ? Math.PI - u * Math.PI
    : Math.PI + u * Math.PI;
  return target.set(
    Math.cos(gatewayAngle) * 0.9,
    Math.sin(gatewayAngle) * 0.82,
    (upperGate ? 0.13 : -0.045) + Math.cos(gatewayAngle) * 0.045,
  );
}

export function createMorphGeometry(compact: boolean) {
  const lengthSegments = compact ? 112 : 184;
  const widthSegments = compact ? 9 : 14;
  const strandCount = 3;
  const verticesPerStrand = (lengthSegments + 1) * (widthSegments + 1);
  const count = verticesPerStrand * strandCount;
  const positions = [
    new Float32Array(count * 3),
    new Float32Array(count * 3),
    new Float32Array(count * 3),
    new Float32Array(count * 3),
  ];
  const seeds = new Float32Array(count);
  const along = new Float32Array(count);
  const strandIds = new Float32Array(count);
  const indices: number[] = [];
  const mantaSpine = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0.54, 0.04),
      new THREE.Vector3(-0.035, 0.28, 0.2),
      new THREE.Vector3(0.025, 0.02, 0.3),
      new THREE.Vector3(-0.02, -0.22, 0.18),
      new THREE.Vector3(0.015, -0.58, 0.04),
      new THREE.Vector3(0, -1.02, -0.08),
    ],
    false,
    "centripetal",
    0.42,
  );
  const stateSettings = [
    { braid: 0.062, width: 0.11, twists: 1.3, fold: 0.072 },
    { braid: 0.022, width: 0.45, twists: 0.055, fold: 0.032 },
    { braid: 0.032, width: 0.23, twists: 0.12, fold: 0.046 },
    { braid: 0.02, width: 0.22, twists: 0.08, fold: 0.036 },
  ];
  const point = new THREE.Vector3();
  const previous = new THREE.Vector3();
  const next = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const depth = new THREE.Vector3();
  const ribbonDirection = new THREE.Vector3();
  const result = new THREE.Vector3();

  for (let strand = 0; strand < strandCount; strand += 1) {
    const strandPhase = (strand / strandCount) * Math.PI * 2;
    const strandOffset = strand * verticesPerStrand;

    for (let lengthIndex = 0; lengthIndex <= lengthSegments; lengthIndex += 1) {
      const u = lengthIndex / lengthSegments;
      const taper = 0.18 + Math.pow(Math.max(Math.sin(Math.PI * u), 0), 0.3) * 0.82;

      for (let widthIndex = 0; widthIndex <= widthSegments; widthIndex += 1) {
        const across = (widthIndex / widthSegments) * 2 - 1;
        const index = strandOffset + lengthIndex * (widthSegments + 1) + widthIndex;
        const seed = ((Math.sin(index * 91.733) * 43758.5453) % 1 + 1) % 1;
        seeds[index] = seed;
        along[index] = u;
        strandIds[index] = strand / Math.max(strandCount - 1, 1);

        stateSettings.forEach((settings, state) => {
          samplePath(state, u, strand, mantaSpine, point);
          samplePath(state, Math.max(0, u - 0.002), strand, mantaSpine, previous);
          samplePath(state, Math.min(1, u + 0.002), strand, mantaSpine, next);
          tangent.copy(next).sub(previous).normalize();
          side.set(-tangent.y, tangent.x, 0).normalize();
          if (side.lengthSq() < 0.001) side.set(1, 0, 0);
          depth.crossVectors(tangent, side).normalize();

          const twist = u * Math.PI * 2 * settings.twists +
            (state === 0 ? strandPhase : 0);
          const twistCos = Math.cos(twist);
          const twistSin = Math.sin(twist);
          let braidProfile = 0.62 + Math.sin(Math.PI * u) * 0.38;
          if (state === 1) braidProfile = 0.24 + Math.abs(u - 0.5) * 0.5;
          if (state === 2) braidProfile = 0.34 + Math.sin(Math.PI * u) * 0.26;
          if (state === 3) braidProfile = 0.3 + Math.sin(Math.PI * u) * 0.2;
          const braidRadius = settings.braid * braidProfile;
          result
            .copy(point)
            .addScaledVector(side, twistCos * braidRadius)
            .addScaledVector(depth, twistSin * braidRadius);
          result.z += Math.sin(u * Math.PI * 5 + strandPhase) * settings.fold;

          ribbonDirection
            .copy(side)
            .multiplyScalar(Math.cos(twist + strandOffset * 0.07))
            .addScaledVector(depth, Math.sin(twist + strandOffset * 0.07))
            .normalize();
          const spineWidth = strand === 2 && state > 0
            ? state === 1 ? 0.38 : state === 2 ? 0.82 : 0.3
            : 1;
          const width = settings.width * spineWidth * taper *
            (0.94 + Math.sin(u * Math.PI * 7 + strandPhase) * 0.06);
          result.addScaledVector(ribbonDirection, across * width);
          setVector(positions[state], index, result);
        });
      }
    }

    for (let lengthIndex = 0; lengthIndex < lengthSegments; lengthIndex += 1) {
      for (let widthIndex = 0; widthIndex < widthSegments; widthIndex += 1) {
        const row = widthSegments + 1;
        const a = strandOffset + lengthIndex * row + widthIndex;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions[0], 3));
  geometry.setAttribute("aTarget1", new THREE.BufferAttribute(positions[1], 3));
  geometry.setAttribute("aTarget2", new THREE.BufferAttribute(positions[2], 3));
  geometry.setAttribute("aTarget3", new THREE.BufferAttribute(positions[3], 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  geometry.setAttribute("aStrand", new THREE.BufferAttribute(strandIds, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.6);
  return geometry;
}

export function createPointGeometry(surfaceGeometry: THREE.BufferGeometry) {
  const pointGeometry = new THREE.BufferGeometry();
  Object.entries(surfaceGeometry.attributes).forEach(([name, attribute]) => {
    pointGeometry.setAttribute(name, attribute);
  });

  const vertexCount = surfaceGeometry.getAttribute("position").count;
  const pointWeights = new Float32Array(vertexCount);
  const surfaceIndex = surfaceGeometry.getIndex();
  if (surfaceIndex) {
    for (let index = 0; index < surfaceIndex.count; index += 1) {
      pointWeights[surfaceIndex.getX(index)] += 1;
    }
  } else {
    pointWeights.fill(1);
  }
  pointGeometry.setAttribute(
    "aPointWeight",
    new THREE.BufferAttribute(pointWeights, 1),
  );
  pointGeometry.boundingSphere = surfaceGeometry.boundingSphere?.clone() ?? null;
  return pointGeometry;
}
