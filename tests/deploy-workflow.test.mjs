import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MAIN_ONLY = "github.ref == 'refs/heads/main' && github.event_name != 'pull_request'";
const REQUIRED_ACTIONS = [
  "actions/checkout",
  "actions/configure-pages",
  "actions/deploy-pages",
  "actions/setup-node",
  "actions/upload-pages-artifact",
];

function jobBlock(workflow, jobName) {
  const jobs = workflow.slice(workflow.indexOf("\njobs:\n") + 1);
  const start = jobs.indexOf(`  ${jobName}:\n`);
  assert.notEqual(start, -1, `missing ${jobName} job`);
  const rest = jobs.slice(start + `  ${jobName}:\n`.length);
  const next = rest.search(/^  [a-z][a-z0-9_-]*:\n/m);
  return next === -1 ? rest : rest.slice(0, next);
}

test("pull requests produce the required build check without deployment privileges", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/deploy-pages.yml", import.meta.url),
    "utf8",
  );
  const codeql = await readFile(
    new URL("../.github/workflows/codeql.yml", import.meta.url),
    "utf8",
  );
  const jobs = workflow.slice(workflow.indexOf("\njobs:\n") + 1);
  const jobNames = [...jobs.matchAll(/^  ([a-z][a-z0-9_-]*):\n/gm)].map((match) => match[1]);
  const build = jobBlock(workflow, "build");
  const security = jobBlock(workflow, "security");
  const deploy = jobBlock(workflow, "deploy");

  assert.match(workflow, /^on:\n  push:\n    branches: \[main\]\n  pull_request:\n    branches: \[main\]\n  workflow_dispatch:/m);
  assert.match(workflow, /^permissions:\n  contents: read\n\nconcurrency:/m);
  assert.match(
    workflow,
    /group: pages-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\n  cancel-in-progress: false/,
  );
  assert.doesNotMatch(workflow, /cancel-in-progress: true/);
  assert.deepEqual(jobNames, ["build", "visual", "security", "deploy"]);
  assert.match(codeql, /jobs:\n  analyze:/, "CodeQL must provide the required analyze check");

  assert.match(
    build,
    /^    permissions:\n      contents: read\n      pages: read\n    runs-on: ubuntu-latest/m,
  );
  assert.match(build, /run: npm ci --ignore-scripts/);
  assert.match(build, /run: npx playwright install chromium/);
  assert.match(
    build,
    /^    runs-on: ubuntu-latest\n    timeout-minutes: \d+$/m,
    "a hung build must fail instead of holding the required check open",
  );
  assert.match(
    build,
    /Install Chromium\n        timeout-minutes: \d+\n        run: npx playwright install chromium/,
    "the browser download must be bounded",
  );
  assert.match(build, /run: npm audit --audit-level=moderate/);
  assert.match(build, /run: npm test/);
  assert.match(build, /VITE_POSTHOG_KEY: \$\{\{ vars\.POSTHOG_PROJECT_KEY \}\}/);
  assert.match(build, /VITE_POSTHOG_HOST: https:\/\/us\.i\.posthog\.com/);
  assert.match(
    build,
    /VITE_POSTHOG_IP_DISCARD_CONFIRMED: \$\{\{ vars\.POSTHOG_IP_DISCARD_CONFIRMED \}\}/,
  );
  const visual = jobBlock(workflow, "visual");
  assert.match(visual, /runs-on: macos-/, "the scene baseline targets macOS");
  assert.match(
    visual,
    /run: npm run test:visual -- --browsers=chromium --skip-performance --skip-pulse/,
    "timer-sampled figures belong to the recording machine, not the runner",
  );
  assert.match(visual, /^    timeout-minutes: \d+$/m, "a hung scene run must fail");
  assert.doesNotMatch(visual, /(?:pages|id-token|security-events): write/);
  assert.doesNotMatch(build, /test:visual/, "the scene runs in its own job");
  assert.doesNotMatch(workflow, /\$\{\{ secrets\./);
  assert.doesNotMatch(build, /(?:contents|pages|id-token|security-events): write/);

  assert.match(
    build,
    new RegExp(`Configure Pages\\n        if: ${MAIN_ONLY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  );
  assert.match(
    build,
    new RegExp(`Upload Pages artifact\\n        if: ${MAIN_ONLY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  );
  assert.match(security, new RegExp(`^    if: ${MAIN_ONLY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"));
  assert.match(security, /contents: read\n      security-events: write/);
  assert.match(security, /uses: \.\/\.github\/workflows\/codeql\.yml/);
  assert.match(deploy, new RegExp(`^    if: ${MAIN_ONLY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"));
  assert.match(deploy, /permissions:\n      pages: write\n      id-token: write/);
  assert.match(deploy, /needs: \[build, visual, security\]/);

  const externalUses = [...workflow.matchAll(/uses: ([^\s@]+)@([^\s#]+)/g)];
  assert.deepEqual(
    [...new Set(externalUses.map(([, action]) => action))].sort(),
    REQUIRED_ACTIONS,
  );
  for (const [, action, reference] of externalUses) {
    assert.match(
      reference,
      /^[0-9a-f]{40}$/,
      `${action} must pin an immutable commit, not a tag`,
    );
  }
  assert.doesNotMatch(workflow, /uses: [^\s]+@v\d+/);
});
