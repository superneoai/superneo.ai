from pathlib import Path
from tempfile import TemporaryDirectory
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
import json
import re
import shutil
import subprocess

BRAND = Path(__file__).resolve().parent
ROOT = BRAND.parent
FONT = ROOT / "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2"
LICENSE = ROOT / "node_modules/@fontsource-variable/geist/LICENSE"
MASTER = BRAND / "superneo-rectangle.svg"
COVER = BRAND / "superneo-x-cover.svg"
TRACKING = -0.075
INK_HEIGHT = 260
GAP_RATIO = 0.1192
FRAME_X = 160
FRAME_HEIGHT = 600
NEO_WIDTH = 750
COVER_WIDTH = 1500
COVER_HEIGHT = 500


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def compact(path):
    return re.sub(
        r"-?\d+(?:\.\d+)?",
        lambda match: f"{float(match.group()):.3f}".rstrip("0").rstrip("."),
        path,
    )


with TemporaryDirectory() as directory:
    instance_path = Path(directory) / "Geist-500.ttf"
    font = instantiateVariableFont(TTFont(FONT), {"wght": 500}, inplace=False)
    font.flavor = None
    font.save(instance_path)
    shaped = json.loads(subprocess.check_output([
        "hb-shape",
        str(instance_path),
        "SUPER",
        "--features=kern=1",
        "--output-format=json",
        "--no-glyph-names",
    ]))
    glyph_set = font.getGlyphSet()
    tracking = TRACKING * font["head"].unitsPerEm
    positions = []
    paths = []
    bounds = []
    x = 0
    for index, item in enumerate(shaped):
        position = x + item["dx"]
        positions.append(position)
        glyph_name = font.getGlyphName(item["g"])
        pen = SVGPathPen(glyph_set)
        glyph_set[glyph_name].draw(pen)
        paths.append(compact(pen.getCommands()))
        bounds_pen = BoundsPen(glyph_set)
        glyph_set[glyph_name].draw(bounds_pen)
        bounds.append((bounds_pen.bounds[0] + position, bounds_pen.bounds[2] + position))
        x += item["ax"]
        if index < len(shaped) - 1:
            x += tracking
    scale = INK_HEIGHT / 742
    baseline = 726 * scale
    ink_left = min(bound[0] for bound in bounds) * scale
    ink_right = max(bound[1] for bound in bounds) * scale
    gap = INK_HEIGHT * GAP_RATIO
    neo_translate = ink_right + gap
    side_margin = FRAME_X + ink_left
    master_width = FRAME_X + neo_translate + NEO_WIDTH + side_margin
    cover_height = master_width * COVER_HEIGHT / COVER_WIDTH
    cover_y = (FRAME_HEIGHT - cover_height) / 2
    path_lines = "\n".join(
        f'      <path d="{path}" transform="translate({position:g})"/>'
        for position, path in zip(positions, paths)
    )
    outlined = (
        f'    <g fill="#E8E5DC" transform="translate(0 {baseline:.12f}) '
        f'scale({scale:.12f} {-scale:.12f})">\n'
        f"{path_lines}\n"
        "    </g>"
    )
    master = MASTER.read_text()
    pattern = re.compile(
        r'    (?:<text [^>]*>SUPER</text>|<g fill="#E8E5DC"[^>]*>.*?\n    </g>)',
        re.DOTALL,
    )
    master, replacements = pattern.subn(outlined, master, count=1)
    if replacements != 1:
        raise RuntimeError("SUPER artwork was not found")
    master = re.sub(
        r'width="[^"]+" height="600" viewBox="0 0 [^"]+"',
        f'width="{master_width:.12f}" height="600" viewBox="0 0 {master_width:.12f} 600"',
        master,
        count=1,
    )
    master = re.sub(
        r'<g transform="translate\([^)]* 0\)"><use href="#neo"',
        f'<g transform="translate({neo_translate:.12f} 0)"><use href="#neo"',
        master,
        count=1,
    )
    MASTER.write_text(master)
    cover = master.replace(
        f'width="{master_width:.12f}" height="600" viewBox="0 0 {master_width:.12f} 600"',
        f'width="1500" height="500" viewBox="0 {cover_y:.12f} {master_width:.12f} {cover_height:.12f}"',
        1,
    ).replace(
        "SUPERNEO horizontal rectangular logo",
        "SUPERNEO X cover",
        1,
    )
    COVER.write_text(cover)
    shutil.copyfile(LICENSE, BRAND / "GEIST-LICENSE.txt")
    exports = [
        (MASTER, "superneo-rectangle", round(master_width), FRAME_HEIGHT),
        (COVER, "superneo-x-cover", COVER_WIDTH, COVER_HEIGHT),
    ]
    for source, name, width, height in exports:
        png = BRAND / f"{name}.png"
        black = Path(directory) / f"{name}-black.png"
        jpeg = BRAND / f"{name}-black.jpeg"
        run("rsvg-convert", "-w", str(width), "-h", str(height), "-o", str(png), str(source))
        run(
            "rsvg-convert",
            "--background-color",
            "#030403",
            "-w",
            str(width),
            "-h",
            str(height),
            "-o",
            str(black),
            str(source),
        )
        run("sips", "-s", "format", "jpeg", "-s", "formatOptions", "95", str(black), "--out", str(jpeg))
