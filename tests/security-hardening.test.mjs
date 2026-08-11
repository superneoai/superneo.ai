import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const requiredPolicy = [
  "default-src 'self'",
  "script-src-attr 'none'",
  "connect-src 'self' https://us.i.posthog.com",
  "worker-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "upgrade-insecure-requests",
];

function contentSecurityPolicy(html) {
  return html.match(
    /<meta http-equiv="Content-Security-Policy" content="([^"]+)"\s*\/>/i,
  )?.[1];
}

for (const path of ["../dist/index.html", "../dist/privacy/index.html"]) {
  test(`${path} carries a restrictive static content security policy`, async () => {
    const html = await readFile(new URL(path, import.meta.url), "utf8");
    const policy = contentSecurityPolicy(html);
    assert.ok(policy, "expected a Content-Security-Policy meta tag");
    requiredPolicy.forEach((directive) => assert.match(policy, new RegExp(
      directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )));
    assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/);
    assert.doesNotMatch(policy, /'unsafe-eval'/);

    const allowedHashes = new Set(
      policy.match(/'sha256-[A-Za-z0-9+/=]+'/g) ?? [],
    );
    const inlineScripts = Array.from(
      html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
      ([, source]) => `'sha256-${createHash("sha256").update(source).digest("base64")}'`,
    );
    inlineScripts.forEach((hash) => assert.ok(
      allowedHashes.has(hash),
      `expected CSP to allow inline script ${hash}`,
    ));
  });
}

test("production bundles exclude development signal controls", async () => {
  const assetsUrl = new URL("../dist/assets/", import.meta.url);
  const fieldAsset = (await readdir(assetsUrl)).find(
    (filename) => filename.startsWith("LatentField-") && filename.endsWith(".js"),
  );
  assert.ok(fieldAsset, "expected the lazy scene bundle");
  const source = await readFile(new URL(fieldAsset, assetsUrl), "utf8");

  assert.doesNotMatch(source, /superneo:qa-signal-progress|qaSignalProgress/);
});
