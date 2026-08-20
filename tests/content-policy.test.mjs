import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PAGES = ["index.html", "privacy/index.html", "legal/index.html"];

test("every page ships a content security policy that keeps scripts local", async () => {
  for (const page of PAGES) {
    const html = await readFile(new URL(`../dist/${page}`, import.meta.url), "utf8");
    const policy = html.match(
      /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/,
    )?.[1];
    assert.ok(policy, `${page} has no content security policy`);

    const directives = new Map(
      policy.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values];
      }),
    );

    assert.deepEqual(directives.get("default-src"), ["'self'"], `${page} default-src`);
    assert.deepEqual(directives.get("script-src"), ["'self'"], `${page} script-src`);
    assert.deepEqual(directives.get("object-src"), ["'none'"], `${page} object-src`);
    assert.deepEqual(directives.get("base-uri"), ["'self'"], `${page} base-uri`);
    assert.deepEqual(
      directives.get("connect-src"),
      ["'self'", "https://us.i.posthog.com", "https://us-assets.i.posthog.com"],
      `${page} connect-src`,
    );
    assert.ok(directives.has("upgrade-insecure-requests"), `${page} upgrade-insecure-requests`);
    assert.ok(
      !policy.includes("'unsafe-eval'"),
      `${page} allows unsafe-eval`,
    );
    assert.ok(
      !directives.get("script-src").includes("'unsafe-inline'"),
      `${page} allows inline script`,
    );
  }
});
