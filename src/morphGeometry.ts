import * as THREE from "three";

function setVector(target: Float32Array, index: number, vector: THREE.Vector3) {
  const offset = index * 3;
  target[offset] = vector.x;
  target[offset + 1] = vector.y;
  target[offset + 2] = vector.z;
}

function polygonRadius(angle: number, sides: number) {
  const segment = (Math.PI * 2) / sides;
  const localAngle = ((angle + segment / 2) % segment + segment) % segment - segment / 2;
  return Math.cos(Math.PI / sides) / Math.cos(localAngle);
}

function samplePath(
  state: number,
  u: number,
  strand: number,
  target: THREE.Vector3,
) {
  const centered = u - 0.5;
  const angle = u * Math.PI * 2;
  if (state === 0) {
    if (strand < 2) {
      const coreAngle = angle + (strand === 0 ? 0 : Math.PI / 4);
      const radius = polygonRadius(coreAngle, 4);
      const scale = strand === 0 ? 1 : 0.69;
      return target.set(
        Math.cos(coreAngle) * radius * 0.72 * scale,
        Math.sin(coreAngle) * radius * 1.02 * scale,
        (strand === 0 ? 0.13 : -0.13) + Math.sin(coreAngle * 2) * 0.055,
      );
    }
    return target.set(
      Math.sin(angle * 2) * 0.09,
      1.08 - u * 2.16,
      0.24 + Math.sin(angle) * 0.12,
    );
  }
  if (state === 1) {
    const strandPhase = strand * Math.PI * 2 / 3;
    const loopRadius = 0.88 + (strand - 1) * 0.13 +
      Math.cos(angle * 3 + strandPhase) * 0.075;
    return target.set(
      Math.cos(angle) * loopRadius,
      Math.sin(angle) * loopRadius * 0.6,
      Math.sin(angle * 2 + strandPhase) * 0.25,
    );
  }
  if (state === 2) {
    if (strand === 0) {
      return target.set(
        Math.cos(angle) * 1.02,
        Math.sin(angle) * 0.34,
        Math.sin(angle) * 0.4,
      );
    }
    if (strand === 1) {
      return target.set(
        Math.cos(angle) * 0.58,
        Math.sin(angle) * 0.96,
        Math.cos(angle) * 0.34,
      );
    }
    const diagonalX = Math.cos(angle) * 0.78;
    const diagonalY = Math.sin(angle) * 0.76;
    return target.set(
      diagonalX * 0.78 + diagonalY * 0.42,
      -diagonalX * 0.54 + diagonalY * 0.72,
      Math.sin(angle) * 0.33,
    );
  }

  if (strand < 2) {
    const gateAngle = angle + Math.PI / 6;
    const gateRadius = polygonRadius(gateAngle, 6) * (strand === 0 ? 1 : 0.71);
    return target.set(
      Math.cos(gateAngle) * gateRadius,
      Math.sin(gateAngle) * gateRadius,
      (strand === 0 ? 0.1 : 0.18) + Math.sin(gateAngle * 3) * 0.04,
    );
  }
  return target.set(
    centered * 4,
    Math.sin(angle) * 0.055,
    0.24 + Math.sin(u * Math.PI) * 0.08,
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
  const stateSettings = [
    { braid: 0.012, width: 0.13, twists: 0.02, fold: 0.02 },
    { braid: 0.014, width: 0.18, twists: 0.5, fold: 0.025 },
    { braid: 0.012, width: 0.13, twists: 0.04, fold: 0.02 },
    { braid: 0.008, width: 0.13, twists: 0.015, fold: 0.018 },
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
          samplePath(state, u, strand, point);
          samplePath(state, Math.max(0, u - 0.002), strand, previous);
          samplePath(state, Math.min(1, u + 0.002), strand, next);
          tangent.copy(next).sub(previous).normalize();
          side.set(-tangent.y, tangent.x, 0).normalize();
          if (side.lengthSq() < 0.001) side.set(1, 0, 0);
          depth.crossVectors(tangent, side).normalize();

          const twist = u * Math.PI * 2 * settings.twists;
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
          let strandWidth = 1;
          if (state === 0 && strand === 2) strandWidth = 0.42;
          if (state === 1 && strand > 0) strandWidth = 0.76;
          if (state === 3 && strand === 1) strandWidth = 0.7;
          if (state === 3 && strand === 2) strandWidth = 0.38;
          let widthProfile = taper;
          if (state === 0 && strand < 2) widthProfile = 0.9;
          if (state === 1 || state === 2) widthProfile = 0.9;
          if (state === 3 && strand < 2) widthProfile = 0.9;
          if (state === 3 && strand === 2) {
            widthProfile = 0.25 + Math.sin(u * Math.PI) * 0.75;
          }
          const width = settings.width * strandWidth * widthProfile *
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
