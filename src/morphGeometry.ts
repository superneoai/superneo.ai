import * as THREE from "three";

function setVector(target: Float32Array, index: number, vector: THREE.Vector3) {
  const offset = index * 3;
  target[offset] = vector.x;
  target[offset + 1] = vector.y;
  target[offset + 2] = vector.z;
}

function setQuadratic(
  target: THREE.Vector3,
  t: number,
  from: [number, number, number],
  control: [number, number, number],
  to: [number, number, number],
) {
  const inverse = 1 - t;
  return target.set(
    inverse * inverse * from[0] + 2 * inverse * t * control[0] + t * t * to[0],
    inverse * inverse * from[1] + 2 * inverse * t * control[1] + t * t * to[1],
    inverse * inverse * from[2] + 2 * inverse * t * control[2] + t * t * to[2],
  );
}

function samplePath(
  state: number,
  u: number,
  strand: number,
  mantaSpine: THREE.CatmullRomCurve3,
  target: THREE.Vector3,
) {
  const centered = u - 0.5;
  if (state === 0) {
    if (strand === 0) {
      const seedAngle = u * Math.PI * 2;
      const seedWidth = 0.48 - Math.cos(seedAngle) * 0.055;
      return target.set(
        Math.sin(seedAngle) * seedWidth,
        -0.3 + Math.cos(seedAngle) * 0.57,
        Math.sin(seedAngle * 2) * 0.035,
      );
    }
    if (strand === 1) {
      return target.set(
        Math.sin(u * Math.PI) * 0.075,
        -0.02 + u * 1.03,
        0.075 + Math.sin(u * Math.PI) * 0.045,
      );
    }
    const leafAngle = Math.PI + u * Math.PI * 2;
    const leafX = Math.cos(leafAngle) * 0.34;
    const leafY = Math.sin(leafAngle) * 0.145;
    const leafRotation = 0.43;
    return target.set(
      0.34 + leafX * Math.cos(leafRotation) - leafY * Math.sin(leafRotation),
      0.87 + leafX * Math.sin(leafRotation) + leafY * Math.cos(leafRotation),
      0.105 + Math.sin(leafAngle) * 0.035,
    );
  }
  if (state === 1) {
    if (strand === 2) {
      mantaSpine.getPointAt(u, target);
      target.x += Math.sin(u * Math.PI * 2) * 0.035;
      return target;
    }
    const side = strand === 0 ? -1 : 1;
    if (u <= 0.5) {
      return setQuadratic(
        target,
        u * 2,
        [0, 0.52, 0.12],
        [side * 0.78, 0.58, 0.18],
        [side * 1.58, -0.02, 0.02],
      );
    }
    return setQuadratic(
      target,
      (u - 0.5) * 2,
      [side * 1.58, -0.02, 0.02],
      [side * 0.92, -0.38, 0.12],
      [0, -0.43, 0.1],
    );
  }
  if (state === 2) {
    if (strand === 2) {
      const irisAngle = u * Math.PI * 2;
      return target.set(
        Math.cos(irisAngle) * 0.38,
        Math.sin(irisAngle) * 0.38,
        0.16 + Math.sin(irisAngle) * 0.025,
      );
    }
    const aperture = Math.pow(Math.max(Math.sin(u * Math.PI), 0), 0.68);
    const upperLid = strand === 0;
    return target.set(
      centered * 2.05,
      (upperLid ? 1 : -1) * aperture * 0.59,
      0.04 + aperture * (upperLid ? 0.085 : 0.045),
    );
  }

  const orbitAngle = u * Math.PI * 2;
  if (strand === 0) {
    return target.set(
      Math.cos(orbitAngle) * 0.62,
      Math.sin(orbitAngle) * 0.62,
      0.08 + Math.sin(orbitAngle) * 0.035,
    );
  }
  const ringRadius = strand === 1 ? 1.58 : 1.34;
  const ringHeight = strand === 1 ? 0.3 : 0.21;
  return target.set(
    Math.cos(orbitAngle) * ringRadius,
    Math.sin(orbitAngle) * ringHeight,
    0.05 + Math.sin(orbitAngle) * (strand === 1 ? 0.24 : 0.18),
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
    { braid: 0.012, width: 0.14, twists: 0.015, fold: 0.022 },
    { braid: 0.014, width: 0.34, twists: 0.025, fold: 0.028 },
    { braid: 0.012, width: 0.18, twists: 0.02, fold: 0.025 },
    { braid: 0.01, width: 0.15, twists: 0.015, fold: 0.02 },
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
          if (state === 0 && strand === 1) strandWidth = 0.38;
          if (state === 0 && strand === 2) strandWidth = 0.58;
          if (state === 1 && strand === 2) strandWidth = 0.42;
          if (state === 2 && strand === 2) strandWidth = 0.72;
          if (state === 3 && strand > 0) strandWidth = 0.52;
          let widthProfile = taper;
          if (state === 0 && strand !== 1) widthProfile = 0.88;
          if (state === 0 && strand === 1) {
            widthProfile = 0.45 + Math.sin(u * Math.PI) * 0.55;
          }
          if (state === 1 && strand < 2) {
            widthProfile = 0.12 + Math.pow(Math.max(Math.sin(u * Math.PI), 0), 0.45) * 0.88;
          }
          if (state === 2 && strand === 2) widthProfile = 0.9;
          if (state === 3) widthProfile = 0.9;
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
