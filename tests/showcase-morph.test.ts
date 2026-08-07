import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  createShowcaseMorphSystem,
  showcaseVertexShader,
} from "../src/showcaseMorph.ts";
import {
  SHOWCASE_COMPACT_CELLS,
  SHOWCASE_DESKTOP_CELLS,
} from "../src/showcaseTargets.ts";

test("the showcase morph stays one stable instanced draw", () => {
  for (const [compact, count] of [[false, SHOWCASE_DESKTOP_CELLS], [true, SHOWCASE_COMPACT_CELLS]] as const) {
    const system = createShowcaseMorphSystem(compact, new THREE.Color("#baf628"));
    const geometry = system.mesh.geometry as THREE.InstancedBufferGeometry;
    assert.equal(system.count, count);
    assert.equal(geometry.instanceCount, count);
    assert.deepEqual(
      Object.keys(geometry.attributes).filter((name) => name.startsWith("aTarget")),
      ["aTarget0", "aTarget1", "aTarget2", "aTarget3"],
    );
    assert.ok(Object.keys(geometry.attributes).length <= 15);
    system.dispose();
  }
});

test("scroll interpolation changes uniforms without rebuilding geometry", () => {
  const system = createShowcaseMorphSystem(true, new THREE.Color("#baf628"));
  const geometry = system.mesh.geometry;
  system.update({
    time: 12,
    fromAct: 1,
    toAct: 2,
    transition: 0.5,
    actProgress: 0.42,
    pointer: new THREE.Vector3(0.2, 0.1, 0),
    pointerStrength: 0.8,
    signalProgress: new Float32Array([0.2, 1.7, 1.7, 1.7, 1.7]),
    reducedMotion: false,
  });
  assert.equal(system.mesh.geometry, geometry);
  assert.equal(system.material.uniforms.uFromAct.value, 1);
  assert.equal(system.material.uniforms.uToAct.value, 2);
  assert.equal(system.material.uniforms.uTransition.value, 0.5);
  assert.equal(system.material.uniforms.uActProgress.value, 0.42);
  system.dispose();
});

test("the shader includes semantic act motion and a true curved morph", () => {
  assert.match(showcaseVertexShader, /animateTarget/);
  assert.match(showcaseVertexShader, /sin\(morph \* PI\)/);
  assert.match(showcaseVertexShader, /sphereOrigin/);
  assert.match(showcaseVertexShader, /uSignalProgress\[5\]/);
});
