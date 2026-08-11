import assert from "node:assert/strict";
import test from "node:test";
import { isSoftwareWebGLRenderer } from "../src/renderCapability.ts";

test("software WebGL renderers use the production poster fallback", () => {
  assert.equal(isSoftwareWebGLRenderer("ANGLE (Google, SwiftShader driver)"), true);
  assert.equal(isSoftwareWebGLRenderer("llvmpipe (LLVM 17.0.6)"), true);
  assert.equal(isSoftwareWebGLRenderer("Software Rasterizer"), true);
  assert.equal(isSoftwareWebGLRenderer("ANGLE (Apple, Apple M3, Metal)"), false);
  assert.equal(isSoftwareWebGLRenderer("NVIDIA GeForce RTX 4090"), false);
  assert.equal(isSoftwareWebGLRenderer(null), false);
});
