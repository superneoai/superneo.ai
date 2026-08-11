import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production deployment is gated by tests and a Chromium visual pass", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/deploy-pages.yml", import.meta.url),
    "utf8",
  );
  const visualRunner = await readFile(
    new URL("./visual/run.mjs", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /pull_request:\s*\n\s+branches: \[main\]/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(
    workflow,
    /npm run test:visual -- --browsers=chromium --skip-performance/,
  );
  assert.doesNotMatch(workflow, /uses: [^\s]+@v\d+/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(
    workflow,
    /deploy:\s*\n\s+if: github\.event_name != 'pull_request'\s*\n\s+permissions:\s*\n\s+pages: write\s*\n\s+id-token: write/,
  );
  assert.match(visualRunner, /import \{ tmpdir \} from "node:os"/);
  assert.match(visualRunner, /resolve\(\s*tmpdir\(\)/);
  assert.doesNotMatch(visualRunner, /"\/private\/tmp"/);
});
