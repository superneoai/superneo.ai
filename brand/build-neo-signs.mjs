import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "..");
const BRAND = resolve(ROOT, "brand");
const PUBLIC = resolve(ROOT, "public");

// Fitted to brand/superneo-rectangle.svg, where the mark stands exactly as tall
// as the SUPER capitals, shares their top and baseline, and sits a gap of 0.1192
// cap heights away.
const CANVAS = { width: 1000, height: 640 };
const SLOT = { x: 182, height: 223, centreY: 319.1 };
const MASTER = { width: 750, height: 260 };

// Power levels measured from the signs this replaces: full carries a solid core,
// medium keeps a trace of it, fault-low is halo alone. The full halo matches the
// original at 21.5 million alpha and a reach of 180 px.
// Each state carries a solid core and one or more blurred layers. The dimmer
// states keep a tight bright layer so the halo holds its gradient instead of
// collapsing into a few alpha steps.
const STATES = [
  { name: "neo-sign-full", core: 1, layers: [[60, 0.6], [60, 0.6], [60, 0.6]] },
  { name: "neo-sign-medium", core: 0.4, layers: [[60, 0.55]] },
  { name: "neo-sign-fault-low", core: 0, layers: [[60, 0.05], [30, 0.42]] },
];

// The sign carries one flat neon colour and varies only alpha. Compositing a
// blur over transparency darkens the colour, so the channels are restored here.
const SIGNAL = [0xba, 0xf6, 0x28];

const neoGroup = (await readFile(resolve(BRAND, "neo-square.svg"), "utf8"))
  .match(/<g id="neo"[\s\S]*?<\/g>\s*<\/defs>/)[0]
  .replace(/\s*<\/defs>$/, "");

const scale = SLOT.height / MASTER.height;
const x = SLOT.x;
const y = SLOT.centreY - (MASTER.height * scale) / 2;

async function build({ name, core, layers }) {
  // The filter region must clear three standard deviations, or it clips the halo.
  const filters = [...new Set(layers.map(([blur]) => blur))]
    .map((blur) => `    <filter id="b${blur}" x="-150%" y="-300%" width="400%" height="700%">
      <feGaussianBlur stdDeviation="${blur}"/>
    </filter>`)
    .join("\n");
  const glow = layers
    .map(([blur, opacity]) => `    <use href="#neo" opacity="${opacity}" filter="url(#b${blur})"/>`)
    .join("\n");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">
  <defs>
${filters}
${neoGroup}
  </defs>
  <g transform="translate(${x} ${y.toFixed(3)}) scale(${scale.toFixed(6)})">
${glow}
${core > 0 ? `    <use href="#neo" opacity="${core}"/>` : ""}
  </g>
</svg>
`;
  const scratch = resolve(BRAND, ".raster");
  await mkdir(scratch, { recursive: true });
  const svgPath = resolve(scratch, `${name}.svg`);
  await writeFile(svgPath, svg);
  const target = resolve(PUBLIC, `${name}.png`);
  await run("rsvg-convert", [
    "-w", String(CANVAS.width),
    "-h", String(CANVAS.height),
    "-o", target,
    svgPath,
  ]);

  const { PNG } = await import("pngjs");
  const png = PNG.sync.read(await readFile(target));
  for (let offset = 0; offset < png.data.length; offset += 4) {
    if (png.data[offset + 3] === 0) continue;
    [png.data[offset], png.data[offset + 1], png.data[offset + 2]] = SIGNAL;
  }
  await writeFile(target, PNG.sync.write(png));
}

for (const state of STATES) await build(state);
console.log("neo signs written from brand/neo-square.svg");
