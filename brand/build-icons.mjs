import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "..");
const BRAND = resolve(ROOT, "brand");
const PUBLIC = resolve(ROOT, "public");

// brand/logo-spec.md section 3: the tread polygon copied to three levels, each
// one 20 units further left.
const TREADS = [
  "60,10 264,10 244,48 40,48",
  "40,111 244,111 224,149 20,149",
  "20,212 224,212 204,250 0,250",
];
const CELL = { width: 264, height: 260 };
const COLOURS = { signal: "#BAF628", bone: "#E8E5DC", ink: "#151513" };
const CANVAS = 512;
const MARK_WIDTH = 360;

function bars(fill) {
  return TREADS.map((points) => `  <polygon points="${points}" fill="${fill}" />`).join("\n");
}

function markSvg(fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CELL.width} ${CELL.height}">
  <title>SUPERNEO e mark</title>
${bars(fill)}
</svg>
`;
}

function iconSvg(body) {
  const scale = MARK_WIDTH / CELL.width;
  const x = (CANVAS - MARK_WIDTH) / 2;
  const y = (CANVAS - CELL.height * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <title>SUPERNEO</title>
${body}
  <g transform="translate(${x} ${y.toFixed(3)}) scale(${scale.toFixed(6)})">
${TREADS.map((points) => `    <polygon points="${points}" fill="currentColor" />`).join("\n")}
  </g>
</svg>
`;
}

// An SVG favicon carries its own colours, so the mark follows the tab theme.
const adaptiveFavicon = iconSvg(`  <style>
    svg { color: ${COLOURS.ink}; }
    @media (prefers-color-scheme: dark) { svg { color: ${COLOURS.signal}; } }
  </style>`);

const flatFavicon = (colour, background) => iconSvg(
  `  <style> svg { color: ${colour}; } </style>${
    background ? `\n  <rect width="${CANVAS}" height="${CANVAS}" fill="${background}" />` : ""
  }`,
);

async function rasterise(svgPath, pngPath, width, height = width) {
  await run("rsvg-convert", ["-w", String(width), "-h", String(height), "-o", pngPath, svgPath]);
}

// An ICO holds whole PNG files behind a small directory.
async function packIco(pngPaths, target) {
  const images = await Promise.all(pngPaths.map(async ({ size, path }) => ({
    size,
    data: await readFile(path),
  })));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = [];
  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 0);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += image.data.length;
  }
  await writeFile(target, Buffer.concat([header, ...entries, ...images.map((i) => i.data)]));
}

async function write(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

for (const [name, colour] of Object.entries(COLOURS)) {
  const svgPath = resolve(BRAND, `e-mark-${name}.svg`);
  await write(svgPath, markSvg(colour));
  // The cell is 264 by 260, so a square raster would stretch the mark.
  const height = Math.round((1024 * CELL.height) / CELL.width);
  await rasterise(svgPath, resolve(BRAND, `e-mark-${name}-1024.png`), 1024, height);
}

await write(resolve(PUBLIC, "favicon.svg"), adaptiveFavicon);

const scratch = resolve(BRAND, ".raster");
await mkdir(scratch, { recursive: true });
const icoSource = resolve(scratch, "favicon-source.svg");
await write(icoSource, flatFavicon(COLOURS.signal));
const icoSizes = [16, 32, 48];
for (const size of icoSizes) {
  await rasterise(icoSource, resolve(scratch, `favicon-${size}.png`), size);
}
await packIco(
  icoSizes.map((size) => ({ size, path: resolve(scratch, `favicon-${size}.png`) })),
  resolve(PUBLIC, "favicon.ico"),
);

// iOS draws its own rounded mask and fills transparency with black, so this icon
// carries the site background instead.
const touchSource = resolve(scratch, "apple-touch-source.svg");
await write(touchSource, flatFavicon(COLOURS.signal, "#030403"));
await rasterise(touchSource, resolve(PUBLIC, "apple-touch-icon.png"), 180);

const webSource = resolve(scratch, "web-icon-source.svg");
await write(webSource, flatFavicon(COLOURS.signal));
for (const size of [192, 512]) {
  await rasterise(webSource, resolve(PUBLIC, `icon-${size}.png`), size);
}

console.log("brand and icon files written");
