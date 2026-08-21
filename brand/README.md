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

`npm run brand:build` uses `wawoff2` to decode `geist-latin-wght-normal.woff2`, then uses HarfBuzzJS to select the weight 500 instance before shaping or outlining. It shapes `SUPER` with kerning, applies four `-75/1000 em` tracking adjustments, extracts the static glyph paths, positions NEO from the outlined SUPER ink bound and target gap ratio, balances the side margins, and regenerates the vector and raster exports.

`npm run brand:check` regenerates the vectors in memory and requires them to be byte-identical to the committed SVGs. Raster exports require `rsvg-convert` and `sips`; all JavaScript dependencies are pinned as development dependencies.

## Licence

Geist is distributed under the SIL Open Font License 1.1. The licence permits use, modification, embedding, and creation of documents or artwork from the font. Its Reserved Font Name and same-licence conditions govern modified font software, while the licence explicitly states that the font-licensing requirement does not apply to documents created with the font. The outlined logo is artwork, not a derived font file.

The package's complete licence text is copied verbatim to `GEIST-LICENSE.txt`.
