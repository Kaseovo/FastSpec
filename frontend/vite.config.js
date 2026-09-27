import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = env.VITE_API_BASE_URL || "http://localhost:8000";

  return {
    test: {
      environment: "jsdom",
      globals: true,
    },
    plugins: [vue()],
    base: "/specs/",
    build: {
      // Monaco and Swagger UI are large by nature; both are split into
      // their own chunks and only loaded when their view is opened.
      chunkSizeWarningLimit: 2000,
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        // The backend's front door (backend/frontdoor.py) handles the /api
        // prefix itself, exactly as in production.
        "/api": { target: apiBase, changeOrigin: true },
        "/auth": { target: apiBase, changeOrigin: true },
        "/mcp": { target: apiBase, changeOrigin: true },
      },
    },
  };
});
