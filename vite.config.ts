import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

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
  plugins: [privacyDevRoute(), react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three/")) return "three";
          if (id.includes("node_modules/gsap/")) return "gsap";
          return undefined;
        },
      },
    },
  },
});
