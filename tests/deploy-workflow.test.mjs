import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MAIN_ONLY = "github.ref == 'refs/heads/main' && github.event_name != 'pull_request'";
const PINNED_ACTIONS = new Map([
  ["actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1"],
  ["actions/setup-node", "820762786026740c76f36085b0efc47a31fe5020"],
  ["actions/configure-pages", "45bfe0192ca1faeb007ade9deae92b16b8254a0d"],
  ["actions/upload-pages-artifact", "fc324d3547104276b827a68afc52ff2a11cc49c9"],
  ["actions/deploy-pages", "cd2ce8fcbc39b97be8ca5fce6e763baed58fa128"],
]);

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
  assert.deepEqual(jobNames, ["build", "security", "deploy"]);
  assert.match(codeql, /jobs:\n  analyze:/, "CodeQL must provide the required analyze check");

  assert.match(
    build,
    /^    permissions:\n      contents: read\n      pages: read\n    runs-on: ubuntu-latest/m,
  );
  assert.match(build, /run: npm ci --ignore-scripts/);
  assert.match(build, /run: npx playwright install --with-deps chromium/);
  assert.match(build, /run: npm audit --audit-level=moderate/);
  assert.match(build, /run: npm test/);
  assert.match(build, /VITE_POSTHOG_KEY: \$\{\{ vars\.POSTHOG_PROJECT_KEY \}\}/);
  assert.match(build, /VITE_POSTHOG_HOST: https:\/\/us\.i\.posthog\.com/);
  assert.match(
    build,
    /VITE_POSTHOG_IP_DISCARD_CONFIRMED: \$\{\{ vars\.POSTHOG_IP_DISCARD_CONFIRMED \}\}/,
  );
  assert.doesNotMatch(workflow, /test:visual/);
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
  assert.match(deploy, /needs: \[build, security\]/);

  const externalUses = [...workflow.matchAll(/uses: ([^\s@]+)@([^\s#]+)/g)];
  assert.equal(externalUses.length, PINNED_ACTIONS.size);
  for (const [, action, reference] of externalUses) {
    assert.equal(reference, PINNED_ACTIONS.get(action), `${action} must use its reviewed SHA`);
    assert.match(reference, /^[0-9a-f]{40}$/);
  }
  assert.doesNotMatch(workflow, /uses: [^\s]+@v\d+/);
});
