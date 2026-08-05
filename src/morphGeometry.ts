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
  nCurve: THREE.CatmullRomCurve3,
  target: THREE.Vector3,
) {
  const centered = u - 0.5;
  const strandOffset = strand - 1;
  if (state === 0) {
    const angle = u * Math.PI * 5.2 - Math.PI * 2.6;
    const compression = 0.42 + Math.cos(u * Math.PI * 6) * 0.07;
    return target.set(
      Math.sin(angle) * compression,
      Math.sin(angle * 0.61 + strandOffset * 0.18) * 0.48,
      Math.cos(angle) * 0.34 + centered * 0.12,
    );
  }
  if (state === 1) {
    nCurve.getPointAt(u, target);
    const convergence = Math.pow(Math.abs(centered) * 2, 1.45);
    target.y += strandOffset * convergence * 0.24;
    target.z += strandOffset * convergence * 0.13;
    return target;
  }
  if (state === 2) {
    const split = THREE.MathUtils.smoothstep(u, 0.34, 0.9);
    const branchCurl = Math.sin((u - 0.32) * Math.PI * 1.4 + strandOffset * 0.82);
    return target.set(
      strandOffset * split * 0.82 + branchCurl * split * 0.14,
      centered * 2.12 + Math.sin(u * Math.PI * 2) * 0.045,
      strandOffset * split * 0.21 + Math.sin(u * Math.PI * 3 + strandOffset) * 0.12,
    );
  }

  const arc = centered * Math.PI * 1.34;
  const radialLayer = 1 + strandOffset * 0.17;
  return target.set(
    Math.sin(arc) * 1.42 * radialLayer,
    (0.48 - Math.cos(arc)) * 0.42 + strandOffset * 0.075,
    strandOffset * 0.27 + Math.sin(arc * 2 + strandOffset * 0.9) * 0.14,
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
  const nCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.98, -0.52, 0.04),
      new THREE.Vector3(-0.72, -0.29, -0.12),
      new THREE.Vector3(-0.24, -0.08, 0.08),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.24, 0.06, -0.08),
      new THREE.Vector3(0.72, 0.27, 0.12),
      new THREE.Vector3(0.98, 0.52, -0.04),
    ],
    false,
    "centripetal",
    0.42,
  );
  const stateSettings = [
    { braid: 0.1, width: 0.12, twists: 3.1, fold: 0.055 },
    { braid: 0.16, width: 0.14, twists: 2.2, fold: 0.075 },
    { braid: 0.12, width: 0.155, twists: 1.65, fold: 0.1 },
    { braid: 0.055, width: 0.18, twists: 0.8, fold: 0.065 },
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
          samplePath(state, u, strand, nCurve, point);
          samplePath(state, Math.max(0, u - 0.002), strand, nCurve, previous);
          samplePath(state, Math.min(1, u + 0.002), strand, nCurve, next);
          tangent.copy(next).sub(previous).normalize();
          side.set(-tangent.y, tangent.x, 0).normalize();
          if (side.lengthSq() < 0.001) side.set(1, 0, 0);
          depth.crossVectors(tangent, side).normalize();

          const twist = u * Math.PI * 2 * settings.twists + strandPhase;
          const twistCos = Math.cos(twist);
          const twistSin = Math.sin(twist);
          let braidProfile = 0.68 + Math.sin(Math.PI * u) * 0.32;
          if (state === 1) braidProfile = 0.14 + Math.abs(u - 0.5) * 1.72;
          if (state === 2) braidProfile = 0.14 + THREE.MathUtils.smoothstep(u, 0.28, 0.84) * 0.86;
          if (state === 3) braidProfile = 0.42;
          const braidRadius = settings.braid * braidProfile;
          result
            .copy(point)
            .addScaledVector(side, twistCos * braidRadius)
            .addScaledVector(depth, twistSin * braidRadius);
          result.z += Math.sin(u * Math.PI * 5 + strandPhase) * settings.fold;

          ribbonDirection
            .copy(side)
            .multiplyScalar(Math.cos(twist + state * 0.31))
            .addScaledVector(depth, Math.sin(twist + state * 0.31))
            .normalize();
          const width =
            settings.width * taper * (0.84 + Math.sin(u * Math.PI * 7 + strandPhase) * 0.16);
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
