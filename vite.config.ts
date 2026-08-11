import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const POSTHOG_INGESTION_ORIGIN = "https://us.i.posthog.com";

function injectSecurityPolicy(html: string) {
  if (html.includes('http-equiv="Content-Security-Policy"')) return html;

  const inlineScriptHashes = Array.from(
    html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
    ([, source]) => `'sha256-${createHash("sha256").update(source).digest("base64")}'`,
  );
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes.join(" ")}`.trim(),
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${POSTHOG_INGESTION_ORIGIN}`,
    "media-src 'self' blob:",
    "worker-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`;

  return html.replace(
    /(<meta charset=["']UTF-8["']\s*\/?\s*>)/i,
    `$1\n    ${meta}`,
  );
}

const productionSecurityPolicy = (): Plugin => ({
  name: "production-security-policy",
  apply: "build",
  enforce: "post",
  transformIndexHtml: {
    order: "post",
    handler: injectSecurityPolicy,
  },
  async closeBundle() {
    const privacyPage = resolve(process.cwd(), "dist/privacy/index.html");
    const html = await readFile(privacyPage, "utf8");
    await writeFile(privacyPage, injectSecurityPolicy(html), "utf8");
  },
});

const privacyDevRoute = (): Plugin => ({
  name: "privacy-dev-route",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const mutableRequest = request as typeof request & { url?: string };
      if (mutableRequest.url) {
        const url = new URL(mutableRequest.url, "http://localhost");
        if (url.pathname === "/privacy" || url.pathname === "/privacy/") {
          mutableRequest.url = `/privacy/index.html${url.search}`;
        }
      }
      next();
    });
  },
});

export default defineConfig({
  base: "./",
  plugins: [privacyDevRoute(), react(), productionSecurityPolicy()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
