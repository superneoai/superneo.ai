# neo stair-e logo specification

## 1. Coordinate system

All dimensions are nominal units recovered from the reference sheet’s printed 3600 × 4500 design system. The master cap/glyph cell is **260 units high**.

## 2. Balanced primary lockup

The combined `e` is treated as one complete rectangular box, not as three independent bar edges.

- `n` box: **230 × 260**
- left gap: **60**
- `e` box: **264 × 260**
- right gap: **60**
- `o` box: **260 × 260**
- full primary lockup: **874 × 260**

Positions are `n x=0`, `e x=290`, and `o x=614`. Both gaps are measured from the complete left/right edges of the `e` box. The `n` and `o` source glyph shapes are unchanged; only their lockup placement is defined.

## 3. Exact e construction

The V12 tread polygon is `P = [(20,0), (224,0), (204,38), (0,38)]`. It is copied without reshaping.

- top: `P + (40,10)`
- middle: `P + (20,111)`
- bottom: `P + (0,212)`

The bar height is **38**, the vertical pitch is **101**, and the clear vertical gap is **63**. Each lower level translates **20 units left**. Each terminal also shears **20 units left across 38 units of depth**, so the orientation is always down-left.

## 4. 3D stair display variant

The three black polygons remain the top tread faces. For this display-only construction, their vertical pitch is compressed from **101 to 70**, leaving a compact **32-unit riser** beneath every tread. The right side is one continuous profile plane following the stair outline, matching the annotated reference rather than using a separate zigzag extrusion.

- top faces: `#151513`
- risers: `#E9E7E1`
- side/extrusion: `#D5D2CA`
- white option: `#FBFAF7` with a black outline

The standalone stair assembly is **264 × 220**, centered inside the same **264 × 260** `e` cell. The full 3D lockup therefore keeps the primary **874 × 260** box and the same **60-unit** gaps.

For presentation, the full lockup is also supplied on an opaque **994 × 380** neutral card. The logo begins at **(60, 60)**, leaving 60 units of visible background on every side. The background is **#F3F1EC** with a subtle **#D8D4CC** edge; this is the preferred preview for the white-face variant because it preserves face separation.

## 5. Usage rules

- Use the flat all-black version as the primary logo.
- Use the grey/white stair faces only when the 3D construction needs to be explained or emphasized.
- Never mirror the shape: the stagger and terminal depth both move down-left.
- Never change tread length, bar height, or the 60-unit inter-letter gaps. The primary 2D `e` uses pitch **101**; only the explanatory 3D stair uses pitch **70**.
- Keep clear space of at least **60 units** around the full lockup.
