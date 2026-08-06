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

const stateNames = ["full", "medium", "fault-low"];

test("the shared NEO states keep one padded 1000 by 640 artboard", async () => {
  const alphaMass = [];
  for (const state of stateNames) {
    const png = await readFile(new URL(`../public/neo-sign-${state}.png`, import.meta.url));
    const { width, height, rgba } = decodeRgbaPng(png);
    assert.deepEqual([width, height], [1000, 640]);
    let borderMax = 0;
    let mass = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = rgba[(y * width + x) * 4 + 3];
        mass += alpha;
        if (x < 32 || y < 32 || x >= width - 32 || y >= height - 32) {
          borderMax = Math.max(borderMax, alpha);
        }
      }
    }
    assert.ok(borderMax <= 1, `${state} glow reaches the artboard edge at ${borderMax}`);
    alphaMass.push(mass);
  }

  assert.ok(alphaMass[0] > 38_000_000, `full glow energy ${alphaMass[0]} is too weak`);
  assert.ok(alphaMass[1] / alphaMass[0] > 0.4 && alphaMass[1] / alphaMass[0] < 0.55);
  assert.ok(alphaMass[2] / alphaMass[0] > 0.15 && alphaMass[2] / alphaMass[0] < 0.25);
});

test("the full NEO state preserves the reference Geist core", async () => {
  const png = await readFile(new URL("../public/neo-sign-full.png", import.meta.url));
  const { width, height, rgba } = decodeRgbaPng(png);
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] < 250) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }

  assert.deepEqual([right - left, bottom - top], [572, 233]);
  assert.ok(Math.abs((left + right) / 2 - width / 2) <= 1);
  assert.ok(Math.abs((top + bottom) / 2 - height / 2) <= 1);
});

test("the deterministic slot projects the NEO core onto the Safari reference", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const slotEm = Number(styles.match(/width:\s*(1\.872)em/)?.[1]);
  const artboardEm = Number(styles.match(/width:\s*(3\.216)em/)?.[1]);
  const opticalEm = Number(styles.match(/left:\s*calc\(50% \+ (0\.051)em\)/)?.[1]);
  const wordShiftEm = Number(styles.match(/\.superneo-word\s*{[^}]*translateY\((-0\.065)em\)/s)?.[1]);
  const neoShiftEm = Number(styles.match(/\.stage-stack \.neo-accent\s*{[^}]*translateY\((0\.065)em\)/s)?.[1]);
  const fontSize = 1280 * 0.107;
  const activeScale = 1.015;
  const artboardWidth = artboardEm * fontSize * activeScale;
  const artboardHeight = artboardWidth * 640 / 1000;
  const slotWidth = slotEm * fontSize * activeScale;
  const coreWidth = artboardWidth * 572 / 1000;
  const coreHeight = artboardWidth * 233 / 1000;
  const slotLeft = 564.0382;
  const artboardTop = 376.7009 + (wordShiftEm + neoShiftEm) * fontSize * activeScale;
  const coreLeft = slotLeft + slotWidth / 2 + opticalEm * fontSize * activeScale - coreWidth / 2;
  const coreTop = artboardTop + artboardHeight * 204 / 640;

  assert.ok(Math.abs(coreWidth - 256) / 256 <= 0.01, `projected width is ${coreWidth}`);
  assert.ok(Math.abs(coreHeight - 104) / 104 <= 0.01, `projected height is ${coreHeight}`);
  assert.ok(Math.abs(coreLeft - 573) <= 2, `projected left edge is ${coreLeft}`);
  assert.ok(Math.abs(coreTop - 467) <= 2, `projected top edge is ${coreTop}`);
});

test("the projected NEO pixels overlap the authoritative Safari mask", async () => {
  const fixture = JSON.parse(await readFile(
    new URL("./fixtures/neo-safari-mask.json", import.meta.url),
    "utf8",
  ));
  const packed = inflateSync(Buffer.from(fixture.data, "base64"));
  const reference = new Uint8Array(fixture.region[2] * fixture.region[3]);
  for (let index = 0; index < reference.length; index += 1) {
    reference[index] = (packed[index >> 3] >> (7 - (index & 7))) & 1;
  }

  const png = await readFile(new URL("../public/neo-sign-full.png", import.meta.url));
  const { width, height, rgba } = decodeRgbaPng(png);
  const artboardWidth = 256 * 1000 / 572;
  const artboardHeight = artboardWidth * height / width;
  const artboardLeft = 573 - artboardWidth * 214 / width;
  const artboardTop = 467 - artboardHeight * 204 / height;
  const [regionLeft, regionTop, regionWidth, regionHeight] = fixture.region;
  let candidateCount = 0;
  let intersection = 0;

  for (let y = 0; y < regionHeight; y += 1) {
    for (let x = 0; x < regionWidth; x += 1) {
      const sourceX = Math.floor((regionLeft + x - artboardLeft) / artboardWidth * width);
      const sourceY = Math.floor((regionTop + y - artboardTop) / artboardHeight * height);
      const candidate = sourceX >= 0 && sourceX < width && sourceY >= 0 && sourceY < height &&
        rgba[(sourceY * width + sourceX) * 4 + 3] > 100;
      const index = y * regionWidth + x;
      if (candidate) candidateCount += 1;
      if (candidate && reference[index]) intersection += 1;
    }
  }

  const overlap = intersection / Math.min(candidateCount, fixture.count);
  assert.ok(overlap >= 0.95, `Safari mask overlap is ${(overlap * 100).toFixed(2)}%`);
});

test("the NEO slot shares SUPER's baseline without browser inline-box inference", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(
    styles,
    /\.superneo-word\s*{[^}]*display:\s*inline-flex;[^}]*align-items:\s*baseline;/s,
  );
  assert.match(styles, /\.superneo-word\s*{[^}]*transform:\s*translateY\(-0\.065em\);/s);
  assert.match(
    styles,
    /\.stage-stack \.neo-accent\s*{[^}]*align-self:\s*baseline;[^}]*transform:\s*translateY\(0\.065em\);/s,
  );
  assert.doesNotMatch(
    styles,
    /\.stage-stack \.neo-accent\s*{[^}]*vertical-align:/s,
  );
});

test("every NEO state stores one neon color in a smooth alpha halo", async () => {
  const signal = [0xba, 0xf6, 0x28];
  for (const state of stateNames) {
    const png = await readFile(new URL(`../public/neo-sign-${state}.png`, import.meta.url));
    const { rgba } = decodeRgbaPng(png);
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
    assert.ok(visiblePixels > 0, `${state} NEO raster contains no visible pixels`);
    assert.ok(offColorPixels / visiblePixels < 0.005);
    assert.ok(alphaLevels.size >= 80, `${state} halo only contains ${alphaLevels.size} levels`);
  }
});
