import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds a complete GitHub Pages artifact", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const field = await readFile(new URL("../src/LatentField.tsx", import.meta.url), "utf8");
  const morph = await readFile(new URL("../src/morphGeometry.ts", import.meta.url), "utf8");
  const shader = await readFile(new URL("../src/latentShader.ts", import.meta.url), "utf8");
  const soundtrack = await readFile(new URL("../src/Soundtrack.tsx", import.meta.url), "utf8");
  const soundtrackEngine = await readFile(
    new URL("../src/soundtrackEngine.ts", import.meta.url),
    "utf8",
  );
  const tipSignal = await readFile(new URL("../src/tipSignal.ts", import.meta.url), "utf8");

  assert.match(html, /<title>superneo\.ai<\/title>/i);
  assert.match(
    html,
    /<meta name="description" content="In the making\."/i,
  );
  assert.match(
    html,
    /<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/i,
  );
  assert.match(html, /<meta name="googlebot" content="index, follow,/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/superneo\.ai\/"/i);
  assert.match(html, /<meta property="og:locale" content="en_US"/i);
  assert.match(html, /<meta property="og:image:type" content="image\/png"/i);
  assert.match(html, /<meta property="og:image:width" content="1200"/i);
  assert.match(html, /<meta property="og:image:height" content="630"/i);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/i);
  assert.match(html, /<meta name="twitter:image:alt"/i);
  assert.doesNotMatch(html, /PRIVATE AI RESEARCH/i);
  assert.doesNotMatch(app, /PRIVATE AI RESEARCH/i);
  assert.doesNotMatch(`${html}\n${app}`, /undisclosed|not public/i);
  assert.match(app, /YOU FOUND IT\./);
  assert.match(app, /Possibility, compressed\./);
  assert.match(app, /Signals converge on a path\./);
  assert.match(app, /New structure appears between them\./);
  assert.match(app, /The structure remains open\./);
  assert.match(app, /<h1>superneo\.ai<\/h1>/);
  assert.match(app, /className="neo-source"[^>]*>NEO<\/span>/);
  assert.match(app, /neo-sign neo-sign--full/);
  assert.match(app, /src=\{neoSignFullUrl\}/);
  assert.doesNotMatch(app, /data-text="NEO"|className="neo-core"/);
  assert.match(app, /<SoundtrackController \/>/);
  assert.match(app, /className="process-head"/);
  assert.match(app, /<ProcessTrace \/>/);
  assert.match(app, /className="stage-stack"/);
  assert.match(app, /heading\.dataset\.state = index === stage/);
  assert.match(app, /heading\.dataset\.depth = String\(index - stage\)/);
  assert.match(app, /window\.addEventListener\(STAGE_CHANGE_EVENT, syncStage\)/);
  assert.doesNotMatch(app, /\bsetStage\b/);
  assert.match(app, /FORM \/ LIVE/);
  assert.match(app, /ITER <output/);
  assert.match(app, /className="bit-loader"/);
  assert.match(app, /percentage\.toString\(2\)\.padStart\(24, "0"\)/);
  assert.match(app, /00000000 00000000 00000000/);
  assert.match(app, /className="block-loader"/);
  assert.match(app, /className="block-stack"/);
  assert.match(app, /syncScrollProgress/);
  assert.match(app, /01 LATENT/);
  assert.match(app, /04 NEO/);
  assert.match(app, /renderStageMeter/);
  assert.doesNotMatch(app, /stageFillOrders/);
  assert.match(html, /https:\/\/superneo\.ai\/og\.png/);
  assert.doesNotMatch(html, /rel="(?:shortcut )?icon"|apple-touch-icon|site\.webmanifest/i);
  assert.match(html, /src="\.\/assets\//);
  assert.doesNotMatch(`${html}\n${app}`, /quietly|becoming|unannounced/i);
  assert.match(morph, /polygonRadius/);
  assert.match(morph, /twists: 0\.5/);
  assert.doesNotMatch(morph, /CatmullRomCurve3/);
  assert.match(morph, /new THREE\.BufferGeometry/);
  assert.match(field, /new THREE\.Points/);
  assert.match(field, /data-no-scene/);
  assert.match(soundtrack, /type="range"/);
  assert.match(soundtrack, /Soundtrack volume/);
  assert.match(soundtrack, /mediaSession/);
  assert.match(soundtrack, /MediaMetadata/);
  assert.match(soundtrack, /title: "superneo\.ai"/);
  assert.doesNotMatch(soundtrack, /className="soundtrack-title"/);
  assert.doesNotMatch(soundtrack, /<b>\{supported/);
  assert.match(soundtrack, /className="soundtrack-ready-icon"/);
  assert.match(soundtrack, />♫<\/span>/);
  assert.match(soundtrackEngine, /AudioContext/);
  assert.match(soundtrackEngine, /BPM = 72/);
  assert.match(soundtrackEngine, /schedulePad/);
  assert.match(soundtrackEngine, /scheduleNoise/);
  assert.match(soundtrackEngine, /setStage/);
  assert.match(soundtrackEngine, /playTipArrivals/);
  assert.match(soundtrackEngine, /scheduleTipTone/);
  assert.match(soundtrackEngine, /voiceIndex/);
  assert.match(soundtrack, /TIP_SIGNAL_EVENT/);
  assert.match(field, /createTipArrivals/);
  assert.match(app, /className="making-line">in the making\.<\/p>/);
  assert.match(styles, /\.making-line/);
  assert.match(app, /className="contact-link x-link"/);
  assert.match(app, /href="https:\/\/x\.com\/superneoai"/);
  assert.match(app, />@superneoai<\/span>/);
  assert.match(app, /aria-hidden="true">𝕏<\/span>/);
  assert.match(tipSignal, /tipTravelSpeed/);
  assert.match(shader, /aTarget1/);
  assert.match(shader, /bayer4/);
  assert.match(shader, /gl_PointCoord/);
  assert.match(shader, /asciiDitherPostFragmentShader/);
  assert.match(shader, /uSignalProgress/);
  assert.match(shader, /uClickAlong/);
  assert.match(shader, /uSignalProgress\[5\]/);
  assert.match(shader, /uClickAlong\[5\]/);
  assert.match(shader, /uSignalVariation\[5\]/);
  assert.match(shader, /signalIndex < 5/);
  assert.match(shader, /uMorphBias/);
  assert.match(shader, /ambientMorph/);
  assert.match(shader, /uStagePhase/);
  assert.match(shader, /transitionEnvelope/);
  assert.match(shader, /spectralShift/);
  assert.match(shader, /violetTone/);
  assert.match(shader, /hotPinkTone/);
  assert.match(shader, /magentaTone/);
  assert.match(shader, /ultravioletTone/);
  assert.match(shader, /indigoTone/);
  assert.match(shader, /electricBlue/);
  assert.match(shader, /iceBlue/);
  assert.match(shader, /flameBlue/);
  assert.match(shader, /periwinkleTone/);
  assert.match(shader, /orchidTone/);
  assert.match(shader, /cubicPalette/);
  assert.match(shader, /time \* 0\.07/);
  assert.match(shader, /ambientWeave/);
  assert.match(shader, /imageZoom/);
  assert.match(shader, /imagePan/);
  assert.match(shader, /layerParallax/);
  assert.match(shader, /ambientFlow/);
  assert.match(shader, /idleWeight/);
  assert.match(shader, /idleOrbit/);
  assert.match(shader, /idleRipple/);
  assert.match(shader, /idleScan/);
  assert.match(shader, /movingLight/);
  assert.match(shader, /atmosphericSpectral/);
  assert.match(shader, /latentBreath/);
  assert.match(shader, /routeWave/);
  assert.match(shader, /growthWave/);
  assert.match(shader, /openRotation/);
  assert.match(shader, /semanticSignal/);
  assert.match(shader, /clickTravelPulse/);
  assert.match(shader, /clickEndpointGlow/);
  assert.match(shader, /tipTravelSpeed/);
  assert.match(shader, /mix\(0\.68, 1\.34/);
  assert.match(shader, /seamlessDissolve/);
  assert.match(shader, /vSignalPulse/);
  assert.match(shader, /vEndpointGlow/);
  assert.doesNotMatch(shader, /uWaveOrigin|waveRadius|vWave|scatterStrength/);
  assert.match(shader, /glyphPhase/);
  assert.match(shader, /inferenceGlyph/);
  assert.match(shader, /emergenceGlyph/);
  assert.match(field, /locateClickAlong/);
  assert.match(field, /MAX_ACTIVE_SIGNALS = 5/);
  assert.match(field, /new Float32Array\(MAX_ACTIVE_SIGNALS\)/);
  assert.match(field, /signalProgressValues\.findIndex/);
  assert.match(field, /signalVariationValues\[availableSignal\] = variation/);
  assert.match(field, /signalProgressValues\[signalIndex\] \+ delta \* SIGNAL_PROGRESS_PER_SECOND/);
  assert.match(field, /motionAccumulator/);
  assert.match(field, /ambientTurn = Math\.sin\(time \* 0\.11\) \* 0\.26/);
  assert.doesNotMatch(field, /ambientTurn = time \* 0\.045/);
  assert.match(field, /objectGroup\.rotation\.z/);
  assert.match(field, /superneo:motion/);
  assert.match(app, /syncMotion/);
  assert.match(app, /scopeSamples/);
  assert.match(app, /className="motion-scope"/);
  assert.match(app, /MOTION/);
  assert.match(app, /className="signal-readouts"/);
  assert.match(app, /className="signal-activity"/);
  assert.match(field, /echoPastMaterial/);
  assert.match(field, /echoFutureMaterial/);
  assert.match(field, /uMorphBias: \{ value: -0\.18 \}/);
  assert.match(field, /uMorphBias: \{ value: 0\.18 \}/);
  assert.match(field, /uDisplacementScale: \{ value: 1\.65 \}/);
  assert.match(field, /uDisplacementScale: \{ value: 2\.05 \}/);
  assert.match(field, /TextureLoader/);
  assert.doesNotMatch(field, /IcosahedronGeometry/);

  assert.equal(
    (await readFile(new URL("../dist/CNAME", import.meta.url), "utf8")).trim(),
    "superneo.ai",
  );
  const jsonLdSource = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i,
  )?.[1];
  assert.ok(jsonLdSource, "expected JSON-LD metadata in the built page");
  const jsonLd = JSON.parse(jsonLdSource);
  assert.equal(jsonLd["@context"], "https://schema.org");
  assert.deepEqual(
    jsonLd["@graph"].map((entry) => entry["@type"]),
    ["WebSite", "Organization", "WebPage", "ImageObject"],
  );
  assert.equal(jsonLd["@graph"][0].url, "https://superneo.ai/");
  assert.equal(jsonLd["@graph"][1].email, "hello@superneo.ai");

  const robots = await readFile(new URL("../dist/robots.txt", import.meta.url), "utf8");
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/superneo\.ai\/sitemap\.xml$/m);

  const sitemap = await readFile(new URL("../dist/sitemap.xml", import.meta.url), "utf8");
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(sitemap, /<loc>https:\/\/superneo\.ai\/<\/loc>/);
  assert.match(sitemap, /<lastmod>2026-08-07<\/lastmod>/);

  await access(new URL("../dist/.nojekyll", import.meta.url));
  await access(new URL("../dist/og.png", import.meta.url));
  await access(new URL("../dist/latent-field.avif", import.meta.url));
  await access(new URL("../dist/latent-field.jpg", import.meta.url));
  await access(new URL("../dist/latent-field-mobile.jpg", import.meta.url));
  await access(new URL("../dist/neo-sign-full.png", import.meta.url));
  await access(new URL("../dist/neo-sign-medium.png", import.meta.url));
  await access(new URL("../dist/neo-sign-fault-low.png", import.meta.url));
  await access(new URL("../dist/robots.txt", import.meta.url));
  await access(new URL("../dist/sitemap.xml", import.meta.url));
});

test("keeps the generated asset paths relative", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const css = await readFile(
    new URL(`../dist/${html.match(/href="(\.\/assets\/[^"]+\.css)"/)?.[1]}`, import.meta.url),
    "utf8",
  );

  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(css, /scroll-rail-fill/);
  assert.match(css, /neo-state-full/);
  assert.match(css, /neo-state-medium/);
  assert.match(css, /neo-state-fault-low/);
  assert.doesNotMatch(css, /gecko-neon-aura/);
  assert.match(css, /soundtrack-control/);
  assert.match(css, /soundtrack-control:hover/);
  assert.match(css, /soundtrack-control:after/);
  assert.match(css, /opacity \.15s \.22s/);
  assert.match(css, /soundtrack-ready-icon/);
  assert.match(css, /signal-monitor/);
  assert.match(css, /visibility:hidden/);
  assert.match(css, /process-head/);
  assert.match(css, /grid-template-columns:1fr auto/);
  assert.match(css, /touch-action:pan-x/);
  assert.match(css, /@media\s*\((?:max-width:|width<=)720px\)/);
  assert.match(css, /--signal:#baf628/);
});
