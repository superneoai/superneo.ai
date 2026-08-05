import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a fresh boot clears a browser-restored deep scroll position", async () => {
  const { resetInitialScroll } = await import("../src/scrollBoot.ts");
  const target = {
    history: { scrollRestoration: "auto" },
    scrollX: 18,
    scrollY: 3240,
    scrollTo({ left, top }) {
      this.scrollX = left;
      this.scrollY = top;
    },
  };

  resetInitialScroll(target);

  assert.equal(target.history.scrollRestoration, "manual");
  assert.equal(target.scrollX, 0);
  assert.equal(target.scrollY, 0);
});

test("the scroll reset runs before React mounts the scroll scene", async () => {
  const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
  const reset = main.indexOf("resetInitialScroll(window)");
  const mount = main.indexOf("createRoot(root).render");

  assert.notEqual(reset, -1, "expected an initial scroll reset");
  assert.ok(reset < mount, "scroll reset must happen before the scene mounts");
});
