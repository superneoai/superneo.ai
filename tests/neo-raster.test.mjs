import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inflateSync } from "node:zlib";

const decodeRgbaPng = (png) => {
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, "NEO raster must remain 8-bit");
      assert.equal(data[9], 6, "NEO raster must remain RGBA");
      assert.equal(data[12], 0, "NEO raster must remain non-interlaced");
    } else if (type === "IDAT") {
      idat.push(data);
    }
    offset += length + 12;
    if (type === "IEND") break;
  }

  const packed = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0, source = 0; y < height; y += 1) {
    const filter = packed[source++];
    const row = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[source++];
      const left = x >= 4 ? rgba[row + x - 4] : 0;
      const up = y > 0 ? rgba[row - stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? rgba[row - stride + x - 4] : 0;
      const prediction = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : NaN;
      assert.equal(Number.isNaN(prediction), false, `unsupported PNG filter ${filter}`);
      rgba[row + x] = (raw + prediction) & 255;
    }
  }
  return { width, height, rgba };
};

test("the shared NEO glow has transparent breathing room instead of a visible box", async () => {
  const png = await readFile(new URL("../public/neo-sign.png", import.meta.url));
  const { width, height, rgba } = decodeRgbaPng(png);
  assert.deepEqual([width, height], [1000, 640]);

  let borderMax = 0;
  let visiblePixels = 0;
  let softAlphaMass = 0;
  let coreLeft = width;
  let coreTop = height;
  let coreRight = 0;
  let coreBottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      if (x < 32 || y < 32 || x >= width - 32 || y >= height - 32) {
        borderMax = Math.max(borderMax, alpha);
      }
      if (alpha > 8) visiblePixels += 1;
      if (alpha > 0 && alpha < 250) softAlphaMass += alpha;
      if (alpha >= 250) {
        coreLeft = Math.min(coreLeft, x);
        coreTop = Math.min(coreTop, y);
        coreRight = Math.max(coreRight, x + 1);
        coreBottom = Math.max(coreBottom, y + 1);
      }
    }
  }

  assert.ok(borderMax <= 1, `outer glow reaches the artboard edge at alpha ${borderMax}`);
  assert.ok(
    visiblePixels < width * height * 0.48,
    `outer glow fills ${(visiblePixels / (width * height) * 100).toFixed(1)}% of its artboard`,
  );
  assert.ok(
    softAlphaMass >= 3_200_000,
    `glow energy ${softAlphaMass} is too weak to read as neon`,
  );
  assert.ok(
    Math.abs((coreLeft + coreRight) / 2 - width / 2) <= 1 &&
      Math.abs((coreTop + coreBottom) / 2 - height / 2) <= 1,
    `glyph core is off-center: ${coreLeft},${coreTop}–${coreRight},${coreBottom}`,
  );
});

test("the NEO raster stores one neon color in a smooth alpha halo", async () => {
  const png = await readFile(new URL("../public/neo-sign.png", import.meta.url));
  const { rgba } = decodeRgbaPng(png);
  const signal = [0xba, 0xf6, 0x28];
  let visiblePixels = 0;
  let offColorPixels = 0;
  const alphaLevels = new Set();

  for (let offset = 0; offset < rgba.length; offset += 4) {
    const alpha = rgba[offset + 3];
    if (alpha === 0) continue;
    visiblePixels += 1;
    alphaLevels.add(alpha);
    const colorError = Math.abs(rgba[offset] - signal[0]) +
      Math.abs(rgba[offset + 1] - signal[1]) +
      Math.abs(rgba[offset + 2] - signal[2]);
    if (colorError > 6) offColorPixels += 1;
  }

  assert.ok(visiblePixels > 0, "NEO raster contains no visible pixels");
  assert.ok(
    offColorPixels / visiblePixels < 0.005,
    `${offColorPixels} of ${visiblePixels} pixels drift away from the neon color`,
  );
  assert.ok(alphaLevels.size >= 180, `halo only contains ${alphaLevels.size} alpha levels`);
});
