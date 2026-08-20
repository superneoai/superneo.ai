import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "..");
const BRAND = resolve(ROOT, "brand");
const PUBLIC = resolve(ROOT, "public");
const MASTER = resolve(BRAND, "e-square.svg");

async function rasterise(svgPath, pngPath, size) {
  await run("rsvg-convert", ["-w", String(size), "-h", String(size), "-o", pngPath, svgPath]);
}

// An ICO holds whole PNG files behind a small directory.
async function packIco(pngPaths, target) {
  const images = await Promise.all(pngPaths.map(async ({ size, path }) => ({
    size,
    data: await readFile(path),
  })));
  const header = Buffer.alloc(6);
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

const master = await readFile(MASTER, "utf8");
await write(resolve(PUBLIC, "favicon.svg"), master);

const scratch = resolve(BRAND, ".raster");
await mkdir(scratch, { recursive: true });

const icoSizes = [16, 32, 48];
for (const size of icoSizes) {
  await rasterise(MASTER, resolve(scratch, `favicon-${size}.png`), size);
}
await packIco(
  icoSizes.map((size) => ({ size, path: resolve(scratch, `favicon-${size}.png`) })),
  resolve(PUBLIC, "favicon.ico"),
);

// iOS fills transparency with black, so this icon carries the site background.
const opaque = master.replace(
  /(<svg[^>]*>)/,
  '$1\n  <rect width="1024" height="1024" fill="#030403" />',
);
const opaquePath = resolve(scratch, "apple-touch-source.svg");
await write(opaquePath, opaque);
await rasterise(opaquePath, resolve(PUBLIC, "apple-touch-icon.png"), 180);

for (const size of [192, 512]) {
  await rasterise(MASTER, resolve(PUBLIC, `icon-${size}.png`), size);
}

console.log("icons written from brand/e-square.svg");
