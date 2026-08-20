import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PINNED = /@[0-9a-f]{40}$/;

test("CodeQL provides the required analyze check with least privilege and pinned actions", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/codeql.yml", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /^on:\n  workflow_call:\n  pull_request:\n    branches: \[main\]\n  schedule:\n    - cron: "17 4 \* \* 2"\n  workflow_dispatch:/m);
  assert.match(workflow, /^permissions:\n  contents: read\n\njobs:/m);

  const jobNames = [...workflow.matchAll(/^  ([a-z][a-z0-9_-]*):$/gm)]
    .map((match) => match[1])
    .filter((name) => !["workflow_call", "pull_request", "schedule", "workflow_dispatch", "contents"].includes(name));
  assert.deepEqual(jobNames, ["analyze"], "the required check name must be analyze");
  assert.match(
    workflow,
    /jobs:\n  analyze:\n    permissions:\n      contents: read\n      security-events: write\n    runs-on: ubuntu-latest/,
  );
  assert.match(workflow, /languages: javascript-typescript/);
  assert.match(workflow, /build-mode: none/);
  const uses = [...workflow.matchAll(/uses: (\S+)/g)].map((match) => match[1]);
  assert.deepEqual(uses.map((entry) => entry.split("@")[0]), [
    "actions/checkout",
    "github/codeql-action/init",
    "github/codeql-action/analyze",
  ]);
  for (const entry of uses) {
    assert.match(entry, PINNED, `${entry} must pin an immutable commit`);
  }
  assert.doesNotMatch(workflow, /uses: [^\s]+@v\d+/);
  assert.doesNotMatch(workflow, /(?:pages|id-token|actions): write/);
});
