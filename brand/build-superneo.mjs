import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as harfbuzz from "harfbuzzjs";
import wawoff2 from "wawoff2";

const BRAND = import.meta.dirname;
const ROOT = resolve(BRAND, "..");
const FONT = resolve(
  ROOT,
  "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
);
const LICENSE = resolve(ROOT, "node_modules/@fontsource-variable/geist/LICENSE");
const MASTER = resolve(BRAND, "superneo-rectangle.svg");
const COVER = resolve(BRAND, "superneo-x-cover.svg");
const TRACKING = -0.075;
const INK_HEIGHT = 260;
const GAP_RATIO = 0.1192;
const FRAME_X = 160;
const FRAME_HEIGHT = 600;
const NEO_WIDTH = 750;
const COVER_WIDTH = 1500;
const COVER_HEIGHT = 500;
const CHECK = process.argv.includes("--check");

function run(command, args) {
  execFileSync(command, args, { stdio: "ignore" });
}

function formatPathNumber(value) {
  const rounded = Number(value.toFixed(3));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function pathData(commands) {
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const segments = [];
  for (let index = 0; index < commands.length; index += 1) {
    const { type, values } = commands[index];
    if (type === "M") {
      [x, y] = values;
      [startX, startY] = values;
      segments.push(`M${values.map(formatPathNumber).join(" ")}`);
    } else if (type === "L") {
      const [endX, endY] = values;
      const closesContour = commands[index + 1]?.type === "Z" &&
        endX === startX && endY === startY;
      if (!closesContour) {
        segments.push(endX === x
          ? `V${formatPathNumber(endY)}`
          : endY === y
            ? `H${formatPathNumber(endX)}`
            : `L${values.map(formatPathNumber).join(" ")}`);
      }
      [x, y] = values;
    } else {
      if (type === "Q") [x, y] = values.slice(-2);
      if (type === "C") [x, y] = values.slice(-2);
      segments.push(type + values.map(formatPathNumber).join(" "));
    }
  }
  return segments.join("");
}

function include(bounds, x, y) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function quadraticAt(start, control, end, time) {
  const inverse = 1 - time;
  return inverse * inverse * start + 2 * inverse * time * control + time * time * end;
}

function cubicAt(start, first, second, end, time) {
  const inverse = 1 - time;
  return inverse ** 3 * start +
    3 * inverse ** 2 * time * first +
    3 * inverse * time ** 2 * second +
    time ** 3 * end;
}

function cubicExtrema(start, first, second, end) {
  const a = -start + 3 * first - 3 * second + end;
  const b = 2 * (start - 2 * first + second);
  const c = first - start;
  if (Math.abs(a) < Number.EPSILON) return b === 0 ? [] : [-c / b];
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant);
  return [(-b + root) / (2 * a), (-b - root) / (2 * a)];
}

function pathBounds(commands) {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  for (const { type, values } of commands) {
    if (type === "M") {
      [x, y] = values;
      [startX, startY] = values;
      include(bounds, x, y);
    } else if (type === "L") {
      [x, y] = values;
      include(bounds, x, y);
    } else if (type === "Q") {
      const [controlX, controlY, endX, endY] = values;
      const denominatorX = x - 2 * controlX + endX;
      const denominatorY = y - 2 * controlY + endY;
      const times = [
        denominatorX === 0 ? -1 : (x - controlX) / denominatorX,
        denominatorY === 0 ? -1 : (y - controlY) / denominatorY,
      ];
      include(bounds, endX, endY);
      for (const time of times) {
        if (time > 0 && time < 1) {
          include(
            bounds,
            quadraticAt(x, controlX, endX, time),
            quadraticAt(y, controlY, endY, time),
          );
        }
      }
      [x, y] = [endX, endY];
    } else if (type === "C") {
      const [firstX, firstY, secondX, secondY, endX, endY] = values;
      const times = [
        ...cubicExtrema(x, firstX, secondX, endX),
        ...cubicExtrema(y, firstY, secondY, endY),
      ];
      include(bounds, endX, endY);
      for (const time of times) {
        if (time > 0 && time < 1) {
          include(
            bounds,
            cubicAt(x, firstX, secondX, endX, time),
            cubicAt(y, firstY, secondY, endY, time),
          );
        }
      }
      [x, y] = [endX, endY];
    } else if (type === "Z") {
      [x, y] = [startX, startY];
      include(bounds, x, y);
    } else {
      throw new Error(`Unsupported glyph path command: ${type}`);
    }
  }
  return bounds;
}

const source = await readFile(FONT);
const sfnt = await wawoff2.decompress(source);
const fontData = sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength);
const blob = new harfbuzz.Blob(fontData);
const face = new harfbuzz.Face(blob);
const font = new harfbuzz.Font(face);
font.setScale(face.upem, face.upem);

// Select the wght=500 instance before shaping or extracting any outline.
font.setVariations([new harfbuzz.Variation("wght", 500)]);

const buffer = new harfbuzz.Buffer();
buffer.addText("SUPER");
buffer.guessSegmentProperties();
harfbuzz.shape(font, buffer, [new harfbuzz.Feature("kern", 1, 0, -1)]);

const glyphs = buffer.getGlyphInfos();
const shapedPositions = buffer.getGlyphPositions();
const tracking = TRACKING * face.upem;
const positions = [];
const paths = [];
const bounds = [];
let x = 0;

for (let index = 0; index < glyphs.length; index += 1) {
  const position = x + shapedPositions[index].xOffset;
  const commands = font.glyphToJson(glyphs[index].codepoint);
  const glyphBounds = pathBounds(commands);
  positions.push(position);
  paths.push(pathData(commands));
  bounds.push([glyphBounds.minX + position, glyphBounds.maxX + position]);
  x += shapedPositions[index].xAdvance;
  if (index < glyphs.length - 1) x += tracking;
}

const scale = INK_HEIGHT / 742;
const baseline = 726 * scale;
const inkLeft = Math.min(...bounds.map(([left]) => left)) * scale;
const inkRight = Math.max(...bounds.map(([, right]) => right)) * scale;
const gap = INK_HEIGHT * GAP_RATIO;
const neoTranslate = inkRight + gap;
const sideMargin = FRAME_X + inkLeft;
const masterWidth = FRAME_X + neoTranslate + NEO_WIDTH + sideMargin;
const coverHeight = masterWidth * COVER_HEIGHT / COVER_WIDTH;
const coverY = (FRAME_HEIGHT - coverHeight) / 2;
const pathLines = paths.map((path, index) => (
  `      <path d="${path}" transform="translate(${positions[index]})"/>`
)).join("\n");
const outlined =
  `    <g fill="#E8E5DC" transform="translate(0 ${baseline.toFixed(12)}) ` +
  `scale(${scale.toFixed(12)} ${(-scale).toFixed(12)})">\n` +
  `${pathLines}\n` +
  "    </g>";
const originalMaster = await readFile(MASTER, "utf8");
const artworkPattern = /    (?:<text [^>]*>SUPER<\/text>|<g fill="#E8E5DC"[^>]*>.*?\n    <\/g>)/s;
assert.match(originalMaster, artworkPattern, "SUPER artwork was not found");
const generatedMaster = originalMaster
  .replace(artworkPattern, outlined)
  .replace(
    /width="[^"]+" height="600" viewBox="0 0 [^"]+"/,
    `width="${masterWidth.toFixed(12)}" height="600" ` +
      `viewBox="0 0 ${masterWidth.toFixed(12)} 600"`,
  )
  .replace(
    /<g transform="translate\([^)]* 0\)"><use href="#neo"/,
    `<g transform="translate(${neoTranslate.toFixed(12)} 0)"><use href="#neo"`,
  );
const generatedCover = generatedMaster
  .replace(
    `width="${masterWidth.toFixed(12)}" height="600" ` +
      `viewBox="0 0 ${masterWidth.toFixed(12)} 600"`,
    `width="1500" height="500" ` +
      `viewBox="0 ${coverY.toFixed(12)} ${masterWidth.toFixed(12)} ${coverHeight.toFixed(12)}"`,
  )
  .replace("SUPERNEO horizontal rectangular logo", "SUPERNEO X cover");

if (CHECK) {
  assert.equal(generatedMaster, originalMaster, "generated rectangle SVG is not byte-identical");
  assert.equal(
    generatedCover,
    await readFile(COVER, "utf8"),
    "generated cover SVG is not byte-identical",
  );
  console.log("SUPER wordmark path data is byte-identical to the committed SVGs");
} else {
  const directory = await mkdtemp(join(tmpdir(), "superneo-brand-"));
  try {
    await writeFile(MASTER, generatedMaster);
    await writeFile(COVER, generatedCover);
    await copyFile(LICENSE, resolve(BRAND, "GEIST-LICENSE.txt"));
    const exports = [
      [MASTER, "superneo-rectangle", Math.round(masterWidth), FRAME_HEIGHT],
      [COVER, "superneo-x-cover", COVER_WIDTH, COVER_HEIGHT],
    ];
    for (const [input, name, width, height] of exports) {
      const png = resolve(BRAND, `${name}.png`);
      const black = resolve(directory, `${name}-black.png`);
      const jpeg = resolve(BRAND, `${name}-black.jpeg`);
      run("rsvg-convert", ["-w", String(width), "-h", String(height), "-o", png, input]);
      run("rsvg-convert", [
        "--background-color", "#030403",
        "-w", String(width),
        "-h", String(height),
        "-o", black,
        input,
      ]);
      run("sips", [
        "-s", "format", "jpeg",
        "-s", "formatOptions", "95",
        black,
        "--out", jpeg,
      ]);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  console.log("SUPERNEO vector and raster exports regenerated");
}
