# SUPERNEO logo exports

- SVG and PNG files have transparent backgrounds.
- JPEG cannot store transparency. Files ending in `-black.jpeg` are compatibility previews flattened on `#030403`.
- SUPER is Geist Variable at weight 500, instanced before outlining, with `-0.075em` tracking between glyphs.
- SUPER and NEO are vector geometry with no live text or font lookup.
- The SUPER-to-NEO gap is `0.1192` of cap height: `30.992` at the `260`-pixel master cap height.
- The dedicated `e` and the `e` inside NEO use the same `230 × 260` master geometry.
- Master bar thickness: `52`; master gap: `52`.

## Canvas sizes

- `e-square.svg`: 1024 × 1024
- `neo-square.svg`: 1024 × 1024
- `superneo-rectangle.svg`: 2144.215959210748 × 600
- `superneo-rectangle.png` and `superneo-rectangle-black.jpeg`: 2144 × 600
- `superneo-x-cover.svg` and `.png`: 1500 × 500
- `superneo-x-cover-black.jpeg`: 1500 × 500

## Rebuild

`build-superneo.py` instances `geist-latin-wght-normal.woff2` at weight 500 with fontTools `varLib.instancer`, shapes `SUPER` with HarfBuzz kerning, applies four `-75/1000 em` tracking adjustments, extracts the static glyph paths, positions NEO from the outlined SUPER ink bound and target gap ratio, balances the side margins, and regenerates the vector and raster exports.

The build requires fontTools with WOFF2 support, `hb-shape`, `rsvg-convert`, and `sips`. Install fontTools into a temporary virtual environment rather than adding it to the website runtime dependencies.

## Licence

Geist is distributed under the SIL Open Font License 1.1. The licence permits use, modification, embedding, and creation of documents or artwork from the font. Its Reserved Font Name and same-licence conditions govern modified font software, while the licence explicitly states that the font-licensing requirement does not apply to documents created with the font. The outlined logo is artwork, not a derived font file.

The package's complete licence text is copied verbatim to `GEIST-LICENSE.txt`.
