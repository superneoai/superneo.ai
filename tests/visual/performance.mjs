import assert from "node:assert/strict";
import { createViewport } from "./browser.mjs";

const requestedUrl = String(
  process.env.SUPERNEO_VISUAL_BASE_URL || "http://127.0.0.1:5176",
).replace(/\/$/, "");
const performanceUrl = new URL(requestedUrl);
performanceUrl.searchParams.set("perf", "1");
performanceUrl.searchParams.set("perfManual", "1");
performanceUrl.searchParams.set("perfDuration", "1200");
const baseUrl = performanceUrl.href;
const viewport = process.env.SUPERNEO_PERF_VIEWPORT === "mobile"
  ? { width: 390, height: 844 }
  : { width: 1280, height: 720 };
const browserName = process.env.SUPERNEO_PERF_BROWSER || "chromium";
const session = await createViewport(browserName, viewport);

try {
  await session.goto(baseUrl);
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (await session.execute(
      `return document.querySelector('.experience')?.dataset.sceneReady === 'true';`,
    )) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const settled = await session.execute(`
      const stage = document.querySelector('.signal-stage');
      return stage && Number.parseFloat(getComputedStyle(stage).opacity) >= 0.99;
    `);
    if (settled) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  const renderer = await session.execute(`
    const canvas = document.querySelector('.signal-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unknown';
  `);
  await session.execute(`window.__superneoStartFrameProbe?.();`);
  const gaps = await session.execute(`
    return new Promise((resolve) => {
      const range = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      const samples = [];
      let pass = 0;
      let started = 0;
      let previous = 0;
      scrollTo(0, range * 0.62);
      const tick = (now) => {
        if (started === 0) {
          started = now;
          previous = now;
        } else {
          samples.push(now - previous);
        }
        previous = now;
        const progress = Math.min(1, (now - started) / 350);
        scrollTo(0, range * (0.62 + progress * 0.38));
        if (progress < 1) return requestAnimationFrame(tick);
        pass += 1;
        if (pass < 3) {
          scrollTo(0, range * 0.62);
          started = 0;
          previous = 0;
          return requestAnimationFrame(tick);
        }
        resolve(samples);
      };
      requestAnimationFrame(tick);
    });
  `);
  let renderReport = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    renderReport = await session.execute(`return document.documentElement.dataset.frameReport || null;`);
    if (renderReport) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const sorted = [...gaps].sort((left, right) => left - right);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const maximum = Math.max(0, ...gaps);
  console.log(JSON.stringify({
    browserName,
    viewport,
    renderer,
    frames: gaps.length,
    p95,
    maximum,
    render: renderReport ? JSON.parse(renderReport) : null,
  }));
  assert.ok(maximum <= 50, `rapid scroll produced a ${maximum.toFixed(1)}ms stopped frame`);
} finally {
  await session.close();
}
