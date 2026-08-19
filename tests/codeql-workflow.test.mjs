import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CHECKOUT_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const CODEQL_SHA = "5595ccaf912efad79be6eef63a5619ff05969be3";

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
  assert.match(workflow, new RegExp(`actions/checkout@${CHECKOUT_SHA}`));
  assert.equal((workflow.match(new RegExp(`github/codeql-action/(?:init|analyze)@${CODEQL_SHA}`, "g")) ?? []).length, 2);
  assert.doesNotMatch(workflow, /uses: [^\s]+@v\d+/);
  assert.doesNotMatch(workflow, /(?:pages|id-token|actions): write/);
});
