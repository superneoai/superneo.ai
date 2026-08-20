import assert from "node:assert/strict";

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software rasterizer/i;
const READY_WAIT_MS = 30_000;

export function selectSceneFallback(capability, failures = []) {
  if (!capability.browserContextAvailable) {
    const unexpectedFailures = failures.filter((failure) => (
      !/Error creating WebGL context|WebGL is not supported/i.test(failure)
    ));
    assert.deepEqual(
      unexpectedFailures,
      [],
      `scene failed for a reason other than absent WebGL: ${unexpectedFailures.join(" | ")}`,
    );
    return "WebGL is unavailable";
  }
  assert.deepEqual(failures, [], `scene failed before readiness: ${failures.join(" | ")}`);
  assert.equal(
    capability.applicationContextAvailable,
    true,
    "the browser provides WebGL but the application renderer did not initialize",
  );
  assert.equal(capability.contextLost, false, "the application WebGL context was lost");
  if (capability.softwareRenderer) return `software WebGL renderer ${capability.renderer}`;
  return null;
}

export function monitorSceneFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  return failures;
}

async function inspectWebGL(page) {
  return page.evaluate(() => {
    const rendererName = (context) => {
      if (!context) return null;
      const extension = context.getExtension("WEBGL_debug_renderer_info");
      return extension
        ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : context.getParameter(context.RENDERER);
    };
    const probeCanvas = document.createElement("canvas");
    const probeContext = probeCanvas.getContext("webgl2")
      ?? probeCanvas.getContext("webgl");
    const applicationCanvas = document.querySelector(".signal-canvas");
    const applicationContext = applicationCanvas instanceof HTMLCanvasElement
      ? applicationCanvas.getContext("webgl2") ?? applicationCanvas.getContext("webgl")
      : null;
    const renderer = rendererName(applicationContext) ?? rendererName(probeContext);
    return {
      browserContextAvailable: probeContext !== null,
      applicationContextAvailable: applicationContext !== null,
      contextLost: applicationContext?.isContextLost() ?? false,
      renderer,
      sceneReady: document.querySelector(".experience")?.getAttribute("data-scene-ready") === "true",
    };
  });
}

export async function waitForSceneOrVerifiedFallback(page, failures) {
  await page.locator(".experience").waitFor({ state: "attached", timeout: 10_000 });
  await page.locator(".signal-canvas").waitFor({ state: "attached", timeout: 5_000 }).catch(() => {});
  const capability = await inspectWebGL(page);
  capability.softwareRenderer = SOFTWARE_RENDERER.test(capability.renderer ?? "");
  process.stdout.write(`# scene WebGL ${JSON.stringify(capability)}\n`);

  if (capability.sceneReady) return { mode: "webgl", capability };
  const fallbackReason = selectSceneFallback(capability, failures);
  if (fallbackReason === null) {
    await page.waitForFunction(
      () => document.querySelector(".experience")?.getAttribute("data-scene-ready") === "true",
      undefined,
      { timeout: READY_WAIT_MS },
    ).catch(() => {
      throw new Error(`hardware WebGL never reached application readiness: ${capability.renderer}`);
    });
    return { mode: "webgl", capability };
  }

  // Headless CI software WebGL can take minutes per UI test, so stop only the
  // scene ticker while exercising overlays through the application's readiness attribute.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.querySelector(".experience")?.setAttribute("data-scene-ready", "true");
  });
  process.stdout.write(`# scene readiness surrogate: ${fallbackReason}\n`);
  return { mode: "surrogate", capability };
}
