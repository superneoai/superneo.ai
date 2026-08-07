import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the complete GitHub Pages showcase", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");
  const morph = await readFile(new URL("../src/showcaseMorph.ts", import.meta.url), "utf8");
  const targets = await readFile(new URL("../src/showcaseTargets.ts", import.meta.url), "utf8");
  const shader = await readFile(new URL("../src/latentShader.ts", import.meta.url), "utf8");
  const sound = await readFile(new URL("../src/Soundtrack.tsx", import.meta.url), "utf8");

  assert.match(html, /<title>superneo\.ai<\/title>/i);
  assert.match(html, /<meta name="description" content="In the making\."/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/superneo\.ai\/"/i);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/i);
  assert.doesNotMatch(html, /rel="(?:shortcut )?icon"|apple-touch-icon|site\.webmanifest/i);
  assert.match(html, /src="\.\/assets\//);

  for (const title of ["LATENT", "INFERENCE", "EMERGENCE", "SUPERNEO"]) {
    assert.match(app, new RegExp(`title: "${title}"`));
  }
  assert.match(app, /Velocity before certainty\./);
  assert.match(app, /A move, predicted\./);
  assert.match(app, /The world resolves\./);
  assert.match(app, /Scale keeps opening\./);
  assert.match(app, /YOU FOUND IT\./);
  assert.match(app, /SHOWCASE_STATE_EVENT/);
  assert.match(app, /className="stage-stack"/);
  assert.match(app, /className="making-line">in the making\.<\/p>/);
  assert.match(app, /<SoundtrackController \/>/);

  assert.match(field, /createShowcaseMorphSystem/);
  assert.match(field, /new THREE\.OrthographicCamera/);
  assert.match(field, /MAX_ACTIVE_SIGNALS = 5/);
  assert.match(field, /dispatchShowcaseImpulse/);
  assert.match(field, /dispatchShowcaseState/);
  assert.match(field, /renderer\.debug\.onShaderError/);
  assert.match(field, /WEBGL_lose_context/);
  assert.doesNotMatch(field, /TextureLoader|neoform|latent-field\.(?:avif|jpg)/i);

  assert.match(morph, /new THREE\.InstancedBufferGeometry/);
  assert.match(morph, /new THREE\.BufferGeometry/);
  assert.match(morph, /new THREE\.Float32BufferAttribute/);
  assert.doesNotMatch(morph, /BoxGeometry|TetrahedronGeometry/);
  assert.match(morph, /aTarget0/);
  assert.match(morph, /aTarget3/);
  assert.match(morph, /uSignalProgress\[5\]/);
  assert.doesNotMatch(morph, /setMatrixAt/);
  assert.match(targets, /SHOWCASE_DESKTOP_CELLS = 6144/);
  assert.match(targets, /SHOWCASE_COMPACT_CELLS = 2048/);
  assert.match(targets, /carTarget/);
  assert.match(targets, /ninjaTarget/);
  assert.match(targets, /islandTarget/);
  assert.match(targets, /cosmicTarget/);

  assert.match(shader, /float fbm\(vec2 p\)/);
  assert.match(shader, /roadHaze/);
  assert.match(shader, /leftDuel/);
  assert.match(shader, /islandLift/);
  assert.match(shader, /galaxyBand/);
  assert.match(shader, /semanticBloomFragmentShader/);
  assert.match(shader, /asciiDitherPostFragmentShader/);
  assert.doesNotMatch(shader, /sampler2D uArtwork/);

  assert.match(sound, /SHOWCASE_IMPULSE_EVENT/);
  assert.match(sound, /type="range"/);
  assert.match(sound, /mediaSession/);

  assert.equal(
    (await readFile(new URL("../dist/CNAME", import.meta.url), "utf8")).trim(),
    "superneo.ai",
  );
  for (const file of [
    ".nojekyll",
    "og.png",
    "showcase-poster-desktop.jpg",
    "showcase-poster-mobile.jpg",
    "neo-sign-full.png",
    "neo-sign-medium.png",
    "neo-sign-fault-low.png",
    "robots.txt",
    "sitemap.xml",
  ]) {
    await access(new URL(`../dist/${file}`, import.meta.url));
  }
});

test("keeps generated asset paths relative and responsive styles intact", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const cssPath = html.match(/href="(\.\/assets\/[^"]+\.css)"/)?.[1];
  assert.ok(cssPath);
  const css = await readFile(new URL(`../dist/${cssPath}`, import.meta.url), "utf8");

  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(css, /soundtrack-control/);
  assert.match(css, /signal-monitor/);
  assert.match(css, /--signal:#baf628/);
  assert.match(css, /@media\s*\((?:max-width:|width<=)720px\)/);
});
