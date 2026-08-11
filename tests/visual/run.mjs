import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { createViewport } from "./browser.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const BASELINE_FILE = resolve(ROOT, "tests/fixtures/visual-baseline.json");
const RESULTS_FILE = resolve(ROOT, "tests/fixtures/visual-results.json");
const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 390, height: 844 },
};
const ALL_BROWSERS = ["chromium", "safari", "zen"];
const cli = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...rest] = argument.replace(/^--/, "").split("=");
    return [key, rest.length > 0 ? rest.join("=") : true];
  }),
);
const recordingBaseline = cli.has("record-baseline");
const skipPerformance = cli.has("skip-performance");
const requestedBrowsers = String(
  cli.get("browsers") || process.env.SUPERNEO_VISUAL_BROWSERS || ALL_BROWSERS.join(","),
).split(",").filter(Boolean);
const outputRoot = resolve(
  tmpdir(),
  recordingBaseline ? "superneo-visual-baseline" : "superneo-visual-current",
);

const sleep = (duration) => new Promise((resolveSleep) => setTimeout(resolveSleep, duration));
const rounded = (value) => Math.round(value * 1000) / 1000;

async function waitFor(session, script, label, timeout = 8_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await session.execute(script)) return;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function startServer() {
  const explicitUrl = cli.get("base-url") || process.env.SUPERNEO_VISUAL_BASE_URL;
  if (explicitUrl) return { baseUrl: String(explicitUrl).replace(/\/$/, ""), process: null };

  const port = Number(cli.get("port") || 4175);
  const child = spawn(
    resolve(ROOT, "node_modules/.bin/vite"),
    ["--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
  let serverOutput = "";
  child.stdout.on("data", (chunk) => { serverOutput += chunk; });
  child.stderr.on("data", (chunk) => { serverOutput += chunk; });
  const baseUrl = `http://127.0.0.1:${port}`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 12_000) {
    if (child.exitCode !== null) {
      throw new Error(`Vite exited before visual tests started:\n${serverOutput}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return { baseUrl, process: child };
    } catch {
      // Keep polling until Vite accepts connections.
    }
    await sleep(100);
  }
  child.kill("SIGTERM");
  throw new Error(`Vite did not start at ${baseUrl}`);
}

function readPng(buffer) {
  return PNG.sync.read(buffer);
}

function greenMask(buffer, targetWidth = 640, targetHeight = 410) {
  const png = readPng(buffer);
  const mask = new Uint8Array(targetWidth * targetHeight);
  let count = 0;
  let touchesEdge = false;
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(png.height - 1, Math.floor(y / targetHeight * png.height));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(png.width - 1, Math.floor(x / targetWidth * png.width));
      const offset = (sourceY * png.width + sourceX) * 4;
      const red = png.data[offset];
      const green = png.data[offset + 1];
      const blue = png.data[offset + 2];
      const active = green >= 92 && green > red * 1.08 && green > blue * 1.08;
      if (!active) continue;
      mask[y * targetWidth + x] = 1;
      count += 1;
      if (x < 2 || y < 2 || x >= targetWidth - 2 || y >= targetHeight - 2) {
        touchesEdge = true;
      }
    }
  }
  return { mask, count, touchesEdge };
}

function maskOverlap(left, right) {
  const width = 640;
  const height = 410;
  let best = 0;
  for (let offsetY = -4; offsetY <= 4; offsetY += 1) {
    for (let offsetX = -4; offsetX <= 4; offsetX += 1) {
      let intersection = 0;
      for (let y = 0; y < height; y += 1) {
        const shiftedY = y + offsetY;
        if (shiftedY < 0 || shiftedY >= height) continue;
        for (let x = 0; x < width; x += 1) {
          const shiftedX = x + offsetX;
          if (shiftedX < 0 || shiftedX >= width) continue;
          if (
            left.mask[y * width + x] &&
            right.mask[shiftedY * width + shiftedX]
          ) {
            intersection += 1;
          }
        }
      }
      best = Math.max(best, intersection);
    }
  }
  return best / Math.max(1, Math.min(left.count, right.count));
}

function posterMetrics(buffer) {
  const png = readPng(buffer);
  let luminance = 0;
  let luminanceSquared = 0;
  let greenCast = 0;
  const pixels = png.width * png.height;
  for (let offset = 0; offset < png.data.length; offset += 4) {
    const red = png.data[offset];
    const green = png.data[offset + 1];
    const blue = png.data[offset + 2];
    const light = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    luminance += light;
    luminanceSquared += light * light;
    greenCast += green - (red + blue) * 0.5;
  }
  const mean = luminance / pixels;
  return {
    mean: rounded(mean),
    deviation: rounded(Math.sqrt(Math.max(0, luminanceSquared / pixels - mean * mean))),
    greenCast: rounded(greenCast / pixels),
  };
}

function assertBootFrame(metrics, label) {
  assert.ok(metrics.mean > 2, `${label} frame is empty/black`);
  assert.ok(metrics.mean < 32, `${label} frame is not using the dimmed boot treatment`);
  assert.ok(metrics.deviation > 3, `${label} frame is visually flat`);
  assert.ok(Math.abs(metrics.greenCast) < 20, `${label} frame has a color cast`);
}

function createRouteMask(buffer) {
  const png = readPng(buffer);
  const pixels = png.width * png.height;
  const distance = new Uint16Array(pixels);
  distance.fill(65_535);
  let sourceCount = 0;
  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 4;
    const light = png.data[offset] * 0.2126 +
      png.data[offset + 1] * 0.7152 + png.data[offset + 2] * 0.0722;
    if (light > 60) {
      distance[index] = 0;
      sourceCount += 1;
    }
  }
  assert.ok(sourceCount > 500, "the rendered route-mask frame is empty");
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = y * png.width + x;
      if (x > 0) distance[index] = Math.min(distance[index], distance[index - 1] + 1);
      if (y > 0) distance[index] = Math.min(distance[index], distance[index - png.width] + 1);
    }
  }
  for (let y = png.height - 1; y >= 0; y -= 1) {
    for (let x = png.width - 1; x >= 0; x -= 1) {
      const index = y * png.width + x;
      if (x + 1 < png.width) {
        distance[index] = Math.min(distance[index], distance[index + 1] + 1);
      }
      if (y + 1 < png.height) {
        distance[index] = Math.min(distance[index], distance[index + png.width] + 1);
      }
    }
  }
  const dilation = Math.max(8, Math.round(png.width * 0.045));
  const mask = new Uint8Array(pixels);
  let count = 0;
  for (let index = 0; index < pixels; index += 1) {
    if (distance[index] > dilation) continue;
    mask[index] = 1;
    count += 1;
  }
  return { width: png.width, height: png.height, mask, count };
}

function pulseMetrics(idleBuffer, arrivalBuffer, routeMask = null) {
  const idle = readPng(idleBuffer);
  const arrival = readPng(arrivalBuffer);
  assert.equal(arrival.width, idle.width);
  assert.equal(arrival.height, idle.height);
  let outsideGreen = 0;
  let outsideCount = 0;
  const tipCandidates = [];
  for (let y = 0; y < idle.height; y += 1) {
    for (let x = 0; x < idle.width; x += 1) {
      const offset = (y * idle.width + x) * 4;
      const idleGreen = Math.max(
        0,
        idle.data[offset + 1] - Math.max(idle.data[offset], idle.data[offset + 2]),
      );
      const arrivalGreen = Math.max(
        0,
        arrival.data[offset + 1] - Math.max(arrival.data[offset], arrival.data[offset + 2]),
      );
      const greenDelta = Math.max(0, arrivalGreen - idleGreen);
      const nx = (x / idle.width - 0.5) / 0.42;
      const ny = (y / idle.height - 0.47) / 0.38;
      const insideRouteMask = routeMask
        ? Boolean(routeMask.mask[y * idle.width + x])
        : nx * nx + ny * ny <= 1;
      if (insideRouteMask) {
        const idleLight = idle.data[offset] * 0.2126 +
          idle.data[offset + 1] * 0.7152 + idle.data[offset + 2] * 0.0722;
        const arrivalLight = arrival.data[offset] * 0.2126 +
          arrival.data[offset + 1] * 0.7152 + arrival.data[offset + 2] * 0.0722;
        tipCandidates.push(Math.max(0, arrivalLight - idleLight));
      } else {
        outsideGreen += greenDelta;
        outsideCount += 1;
      }
    }
  }
  tipCandidates.sort((left, right) => left - right);
  return {
    outsideGreen: Math.round(
      outsideGreen / Math.max(1, outsideCount) / 255 * 100_000,
    ) / 100_000,
    routeCoverage: routeMask
      ? rounded(routeMask.count / (routeMask.width * routeMask.height))
      : null,
    tipPeak: rounded(tipCandidates[Math.floor(tipCandidates.length * 0.999)] || 0),
  };
}

async function capture(session, directory, name) {
  const buffer = await session.screenshot();
  await writeFile(resolve(directory, `${name}.png`), buffer);
  return buffer;
}

async function captureNeoMask(session) {
  await session.execute(`
    const style = document.createElement('style');
    style.id = 'superneo-neo-mask-fixture';
    style.textContent = \`
      html, body, #root, .experience, .stage-panel, .stage-stack, h2,
      .stage-word, .superneo-word, .neo-accent { background: #000 !important; }
      .signal-stage, .signal-poster, .technical-frame, .site-header,
      .making-line, .stage-index, .stage-line, .site-footer, .scroll-rail,
      .scroll-cue, .stage-outline, .stage-trail, .super-prefix {
        visibility: hidden !important;
      }
    \`;
    document.head.appendChild(style);
    return true;
  `);
  const buffer = await session.elementScreenshot(
    'h2[data-state="active"] .stage-word .neo-sign--full',
  );
  await session.execute(
    "document.querySelector('#superneo-neo-mask-fixture')?.remove(); return true;",
  );
  return buffer;
}

async function hideInterface(session) {
  await session.execute(`
    const style = document.createElement('style');
    style.id = 'superneo-scene-only-fixture';
    style.textContent = \`
      .technical-frame, .site-header, .making-line, .stage-panel,
      .scroll-rail, .scroll-cue, .site-footer { visibility: hidden !important; }
    \`;
    document.head.appendChild(style);
    return true;
  `);
}

async function captureRouteMask(session, pageUrl, directory) {
  await session.goto(pageUrl);
  await waitForRoot(session);
  await waitForScene(session);
  await setScroll(session, 1);
  await hideInterface(session);
  const buffer = await capture(session, directory, "object-route-mask");
  return createRouteMask(buffer);
}

async function waitForRoot(session) {
  await waitFor(
    session,
    "return Boolean(document.querySelector('.experience'));",
    "the React root",
  );
}

async function waitForScene(session, ready = true) {
  const readyCondition = `
    const experience = document.querySelector('.experience');
    if (experience?.dataset.sceneReady !== 'true') return false;
    const stage = document.querySelector('.signal-stage');
    const poster = document.querySelector('.signal-poster');
    if (!stage || !poster) return false;
    return Number(getComputedStyle(stage).opacity) >= 0.999 &&
      getComputedStyle(poster).visibility === 'hidden';
  `;
  await waitFor(
    session,
    ready
      ? readyCondition
      : "return document.querySelector('.experience')?.dataset.sceneReady === 'false';",
    ready ? "the completed WebGL reveal" : "the poster fallback",
    60_000,
  );
}

async function waitForWordmarkSettle(session) {
  await waitFor(
    session,
    `
      const wordmark = document.querySelector('h2[data-state="active"] .stage-word');
      if (!wordmark) return false;
      const transform = getComputedStyle(wordmark).transform;
      if (transform === 'none') return true;
      const matrix = new DOMMatrixReadOnly(transform);
      return Math.abs(matrix.m41) < 0.1 && Math.abs(matrix.m42) < 0.1;
    `,
    "the settled final-stage wordmark",
  );
}

async function stateSnapshot(session) {
  return session.execute(`
    const experience = document.querySelector('.experience');
    const poster = document.querySelector('.signal-poster');
    const stage = document.querySelector('.signal-stage');
    const artwork = Array.from(document.querySelectorAll('.signal-artwork-fallback'))
      .find((element) => getComputedStyle(element).display !== 'none');
    return {
      ready: experience?.dataset.sceneReady,
      poster: poster ? getComputedStyle(poster).display : null,
      stage: stage ? getComputedStyle(stage).visibility : null,
      artwork: artwork ? getComputedStyle(artwork).backgroundImage : null,
      loader: document.querySelector('.scene-loader-label')?.textContent?.trim() ?? null,
      innerWidth,
      innerHeight,
    };
  `);
}

async function setScroll(session, progress) {
  await session.execute(`
    const range = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
    scrollTo(0, range * arguments[0]);
    return scrollY;
  `, progress);
  await sleep(150);
}

async function forceNeoState(session, state) {
  await session.execute(`
    document.querySelectorAll('.neo-sign').forEach((sign) => {
      sign.style.animation = 'none';
      sign.style.opacity = sign.classList.contains('neo-sign--' + arguments[0]) ? '1' : '0';
    });
    return true;
  `, state);
}

async function assertCheckpoint(session, expectedStage) {
  const checkpoint = await session.execute(`
    const active = Array.from(document.querySelectorAll('.stage-stack h2'))
      .findIndex((heading) => heading.dataset.state === 'active');
    return {
      active,
      phase: document.querySelector('.signal-readouts span:nth-child(3) output')?.textContent,
      innerHeight,
    };
  `);
  assert.equal(checkpoint.active, expectedStage, "text checkpoint diverged from scroll stage");
  assert.equal(checkpoint.phase, `0${expectedStage + 1}`, "status checkpoint diverged");
  return checkpoint;
}

async function measureGeometry(session) {
  return session.execute(`
    const rect = (selector) => {
      const bounds = document.querySelector(selector).getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    };
    const activeHeading = document.querySelector('h2[data-state="active"]');
    const headingStyle = getComputedStyle(activeHeading);
    return {
      super: rect('h2[data-state="active"] .stage-word .super-prefix'),
      neo: rect('h2[data-state="active"] .stage-word .neo-sign--full'),
      word: rect('h2[data-state="active"] .stage-word .superneo-word'),
      environment: {
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        visualWidth: window.visualViewport?.width ?? null,
        devicePixelRatio,
        fontSize: headingStyle.fontSize,
        transform: headingStyle.transform,
        panel: rect('.stage-panel'),
      },
    };
  `);
}

function assertDesktopGeometry(geometry) {
  const core = {
    x: geometry.neo.x + geometry.neo.width * 214 / 1000,
    y: geometry.neo.y + geometry.neo.height * 204 / 640,
    width: geometry.neo.width * 572 / 1000,
    height: geometry.neo.height * 233 / 640,
  };
  const diagnostics = JSON.stringify(geometry.environment);
  assert.ok(Math.abs(core.x - 573) <= 2, `NEO core x is ${core.x}; ${diagnostics}`);
  assert.ok(Math.abs(core.y - 467) <= 2, `NEO core y is ${core.y}; ${diagnostics}`);
  assert.ok(Math.abs(core.width - 256) / 256 <= 0.01, `NEO core width is ${core.width}`);
  assert.ok(Math.abs(core.height - 104) / 104 <= 0.01, `NEO core height is ${core.height}`);
  return core;
}

async function preparePulsePage(session, pageUrl) {
  await session.goto(pageUrl);
  await waitForRoot(session);
  await waitForScene(session);
  await setScroll(session, 1);
  await session.execute("Math.random = () => 0.5; return true;");
}

async function runPulse(session, directory, pageUrl, routeMask = null) {
  await preparePulsePage(session, pageUrl);
  await hideInterface(session);
  await sleep(180);
  const idle = await capture(session, directory, "pulse-idle");
  await session.execute(`
    const x = innerWidth * 0.5;
    const y = innerHeight * 0.46;
    window.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, button: 0, buttons: 1, clientX: x, clientY: y,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, button: 0, buttons: 0, clientX: x, clientY: y,
    }));
    return true;
  `);
  await sleep(140);
  await capture(session, directory, "pulse-travel");
  await sleep(760);
  const arrival = await capture(session, directory, "pulse-arrival");
  await sleep(850);
  await capture(session, directory, "pulse-fade");
  return pulseMetrics(idle, arrival, routeMask);
}

async function runPerformanceSample(session, baseUrl) {
  await session.goto(`${baseUrl}/?perf=1&perfDelay=1200&perfDuration=3600`);
  await waitForRoot(session);
  await waitForScene(session);
  await sleep(1_250);
  await session.execute(`
    window.__superneoRapidScrollDone = false;
    (async () => {
      const range = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
      scrollTo(0, range * 0.62);
      await wait(70);
      const startedAt = performance.now();
      await new Promise((resolve) => {
        const step = (now) => {
          const progress = Math.min(1, (now - startedAt) / 350);
          const eased = progress * progress * (3 - 2 * progress);
          scrollTo(0, range * (0.62 + 0.38 * eased));
          if (progress < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      await wait(70);
      window.__superneoRapidScrollDone = true;
    })();
    return true;
  `);
  await waitFor(
    session,
    "return window.__superneoRapidScrollDone === true;",
    "the rapid scroll replay",
  );
  await waitFor(
    session,
    "return Boolean(document.documentElement.dataset.frameReport);",
    "the frame probe report",
    8_000,
  );
  return session.execute(
    "return JSON.parse(document.documentElement.dataset.frameReport);",
  );
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

async function runPerformance(session, baseUrl) {
  const samples = [];
  for (let replay = 0; replay < 3; replay += 1) {
    samples.push(await runPerformanceSample(session, baseUrl));
  }
  return {
    frames: Math.round(median(samples.map((sample) => sample.frames))),
    fps: median(samples.map((sample) => sample.fps)),
    p50Gap: median(samples.map((sample) => sample.p50Gap)),
    p95Gap: median(samples.map((sample) => sample.p95Gap)),
    maxGap: Math.max(...samples.map((sample) => sample.maxGap)),
    p95Render: median(samples.map((sample) => sample.p95Render)),
    maxRender: Math.max(...samples.map((sample) => sample.maxRender)),
    over25: samples.reduce((total, sample) => total + sample.over25, 0),
    over50: samples.reduce((total, sample) => total + sample.over50, 0),
    samples,
  };
}

function assertPerformance(current, baseline) {
  assert.ok(current.fps >= baseline.fps * 0.9, `${current.fps} FPS fell below the 10% gate`);
  assert.ok(
    current.p95Render <= baseline.p95Render * 1.1,
    `${current.p95Render}ms p95 render exceeded the 10% gate`,
  );
  assert.ok(current.maxGap <= 50, `${current.maxGap}ms stopped-frame gap detected`);
  assert.equal(current.over50, 0, "frame gaps above 50ms detected");
}

async function runBaselineCase(session, baseUrl, directory) {
  const routeMask = await captureRouteMask(
    session,
    `${baseUrl}/?freezeScene=1&objectMask=1`,
    directory,
  );
  const pulse = await runPulse(
    session,
    directory,
    `${baseUrl}/?freezeScene=1`,
    routeMask,
  );
  const performance = await runPerformance(session, baseUrl);
  return { pulse, performance };
}

async function runVisualCase(session, browserName, viewportName, baseUrl, directory, baseline) {
  const viewport = VIEWPORTS[viewportName];
  const result = { viewport, captures: [], geometry: null, pulse: null, performance: null };
  const stateUrl = (query = "") => `${baseUrl}/${query ? `?${query}` : ""}`;

  await session.goto(stateUrl("neoState=full"));
  await waitForRoot(session);
  await waitForScene(session);
  await waitFor(
    session,
    "return document.querySelector('.stage-stack')?.dataset.signReady === 'true';",
    "the decoded NEO states",
  );
  await setScroll(session, 1);
  for (const neoState of ["full", "medium", "fault-low"]) {
    await forceNeoState(session, neoState);
    await capture(session, directory, `neo-${neoState}`);
    result.captures.push(`neo-${neoState}`);
  }

  await forceNeoState(session, "full");
  const stableHeights = [];
  const stageProgress = [0.02, 0.27, 0.52, 0.78];
  for (let stage = 0; stage < stageProgress.length; stage += 1) {
    await setScroll(session, stageProgress[stage]);
    const checkpoint = await assertCheckpoint(session, stage);
    stableHeights.push(checkpoint.innerHeight);
    await capture(session, directory, `stage-${stage + 1}`);
    result.captures.push(`stage-${stage + 1}`);
  }
  assert.deepEqual(
    [...new Set(stableHeights)],
    [viewport.height],
    "browser chrome changed the fixed scene height while scrolling",
  );
  for (const [index, transition] of [0.245, 0.495, 0.745].entries()) {
    await setScroll(session, transition);
    await capture(session, directory, `transition-${index + 1}`);
    result.captures.push(`transition-${index + 1}`);
  }

  await setScroll(session, 1);
  await waitForWordmarkSettle(session);
  result.geometry = await measureGeometry(session);
  if (viewportName === "desktop") result.geometry.core = assertDesktopGeometry(result.geometry);
  const neoBuffer = await captureNeoMask(session);
  await writeFile(resolve(directory, "neo-mask.png"), neoBuffer);
  result.neoMask = greenMask(neoBuffer);
  assert.ok(result.neoMask.count > 500, "NEO mask is unexpectedly empty");
  assert.equal(result.neoMask.touchesEdge, false, "NEO glow is clipped at its artboard edge");

  const routeMask = await captureRouteMask(
    session,
    stateUrl("freezeScene=1&objectMask=1"),
    directory,
  );
  result.pulse = await runPulse(
    session,
    directory,
    stateUrl("neoState=full&freezeScene=1"),
    routeMask,
  );
  assert.ok(
    result.pulse.outsideGreen < 0.03,
    `pulse green ${result.pulse.outsideGreen} escaped the object/route mask`,
  );
  assert.ok(
    result.pulse.tipPeak >= baseline.pulse.tipPeak * 0.85,
    `tip peak ${result.pulse.tipPeak} fell below 85% of ${baseline.pulse.tipPeak}`,
  );

  await session.goto(stateUrl("sceneDelay=900"));
  await waitForRoot(session);
  const loadingState = await stateSnapshot(session);
  assert.equal(loadingState.ready, "false");
  assert.equal(loadingState.poster, "block");
  assert.match(loadingState.artwork ?? "", /latent-field/);
  assert.match(loadingState.loader ?? "", /SYSTEM BOOT/);
  const loadingFirst = await capture(session, directory, "loading-first");
  const firstMetrics = posterMetrics(loadingFirst);
  assertBootFrame(firstMetrics, "loading first");
  await waitForScene(session);
  await capture(session, directory, "loading-settled");

  for (const fault of ["renderer", "texture", "shader", "context"]) {
    await session.goto(stateUrl(`sceneFault=${fault}`));
    await waitForRoot(session);
    const first = await capture(session, directory, `${fault}-first`);
    await sleep(900);
    const settled = await capture(session, directory, `${fault}-settled`);
    for (const [frame, buffer] of [["first", first], ["settled", settled]]) {
      const state = await stateSnapshot(session);
      const metrics = posterMetrics(buffer);
      assert.equal(state.ready, "false", `${fault} ${frame} frame exposed WebGL`);
      assert.equal(state.poster, "block", `${fault} ${frame} frame hid the poster`);
      assert.match(state.artwork ?? "", /latent-field/);
      assertBootFrame(metrics, `${fault} ${frame}`);
    }
  }

  await session.goto(stateUrl("neoState=full"));
  await waitForRoot(session);
  await waitForScene(session);
  await session.reload();
  await waitForRoot(session);
  await capture(session, directory, "reload-first");
  await waitForScene(session);
  await capture(session, directory, "reload-settled");

  const reducedMotionSupported = await session.emulateReducedMotion(true);
  if (reducedMotionSupported) {
    await session.reload();
    await waitForRoot(session);
    await waitForScene(session);
    await setScroll(session, 1);
    await capture(session, directory, "reduced-motion");
    await session.emulateReducedMotion(false);
  } else {
    await session.goto(stateUrl("neoState=full&reducedMotion=1"));
    await waitForRoot(session);
    await waitForScene(session);
    await setScroll(session, 1);
    await capture(session, directory, "reduced-motion");
  }
  result.reducedMotionCaptured = true;

  await session.goto(stateUrl());
  await waitForRoot(session);
  await waitForScene(session);
  await session.click(".soundtrack-toggle");
  await waitFor(
    session,
    "return document.querySelector('.soundtrack-control')?.dataset.playing === 'true';",
    "audio unlock",
  );
  result.audioUnlocked = true;
  await session.click(".soundtrack-toggle");

  if (!skipPerformance) {
    result.performance = await runPerformance(session, baseUrl);
    assertPerformance(result.performance, baseline.performance);
  }
  delete result.neoMask;
  return { result, neoMask: greenMask(neoBuffer) };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
const server = await startServer();
const previousBaseline = await readJson(BASELINE_FILE, {
  authorityCommit: "84b94ea",
  browsers: {},
});
const previousResults = await readJson(RESULTS_FILE, {
  authorityCommit: "84b94ea",
  testedCommit: "working-tree",
  browsers: {},
  neoOverlap: {},
});
const results = {
  authorityCommit: "84b94ea",
  testedCommit: recordingBaseline ? "84b94ea" : "working-tree",
  browsers: recordingBaseline ? {} : { ...previousResults.browsers },
  neoOverlap: recordingBaseline ? {} : { ...previousResults.neoOverlap },
};
const maskResults = {};
const failures = [];

try {
  for (const browserName of requestedBrowsers) {
    results.browsers[browserName] = {};
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      const key = `${browserName}.${viewportName}`;
      const directory = resolve(outputRoot, browserName, viewportName);
      await mkdir(directory, { recursive: true });
      let session;
      try {
        session = await createViewport(browserName, viewport);
        if (recordingBaseline) {
          results.browsers[browserName][viewportName] = await runBaselineCase(
            session,
            server.baseUrl,
            directory,
          );
        } else {
          const baseline = previousBaseline.browsers?.[browserName]?.[viewportName];
          assert.ok(baseline, `Missing 84b94ea baseline for ${key}`);
          const visual = await runVisualCase(
            session,
            browserName,
            viewportName,
            server.baseUrl,
            directory,
            baseline,
          );
          results.browsers[browserName][viewportName] = visual.result;
          maskResults[`${viewportName}.${browserName}`] = visual.neoMask;
        }
        process.stdout.write(`PASS ${browserName} ${viewportName}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${browserName} ${viewportName}: ${message}`);
        results.browsers[browserName][viewportName] = { error: message };
        process.stderr.write(`FAIL ${browserName} ${viewportName}: ${message}\n`);
      } finally {
        await session?.close().catch(() => undefined);
      }
    }
  }

  if (!recordingBaseline) {
    for (const viewportName of Object.keys(VIEWPORTS)) {
      const available = requestedBrowsers
        .map((browserName) => [browserName, maskResults[`${viewportName}.${browserName}`]])
        .filter(([, mask]) => mask);
      if (available.length < 2) continue;
      results.neoOverlap[viewportName] = {};
      for (let leftIndex = 0; leftIndex < available.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < available.length; rightIndex += 1) {
          const [leftName, leftMask] = available[leftIndex];
          const [rightName, rightMask] = available[rightIndex];
          const overlap = maskOverlap(leftMask, rightMask);
          results.neoOverlap[viewportName][`${leftName}/${rightName}`] = rounded(overlap);
          if (overlap < 0.95) {
            failures.push(
              `${viewportName} NEO overlap ${leftName}/${rightName}: ${(overlap * 100).toFixed(2)}%`,
            );
          }
        }
      }
    }
  }

  if (failures.length === 0) {
    const resultFile = recordingBaseline ? BASELINE_FILE : RESULTS_FILE;
    if (recordingBaseline) {
      for (const [browserName, browserResults] of Object.entries(results.browsers)) {
        previousBaseline.browsers[browserName] = {
          ...(previousBaseline.browsers[browserName] || {}),
          ...browserResults,
        };
      }
      await writeFile(resultFile, `${JSON.stringify(previousBaseline, null, 2)}\n`);
    } else {
      await writeFile(resultFile, `${JSON.stringify(results, null, 2)}\n`);
    }
  }
} finally {
  server.process?.kill("SIGTERM");
}

if (failures.length > 0) {
  throw new AggregateError(failures.map((message) => new Error(message)), failures.join("\n"));
}

process.stdout.write(`Visual artifacts: ${outputRoot}\n`);
