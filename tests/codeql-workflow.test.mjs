import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("CodeQL scans JavaScript and TypeScript with pinned actions", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/codeql.yml", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /pull_request:\s*\n\s+branches: \[main\]/);
  assert.match(workflow, /schedule:\s*\n\s+- cron: "17 4 \* \* 2"/);
  assert.match(workflow, /security-events: write/);
  assert.match(workflow, /languages: javascript-typescript/);
  assert.match(workflow, /build-mode: none/);
  assert.doesNotMatch(workflow, /uses: [^\s]+@v\d+/);
  assert.match(workflow, /github\/codeql-action\/init@[0-9a-f]{40}/);
  assert.match(workflow, /github\/codeql-action\/analyze@[0-9a-f]{40}/);
});
