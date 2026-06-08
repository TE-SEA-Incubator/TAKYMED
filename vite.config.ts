import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const BACKEND_PATH_PREFIXES = ["/api", "/uploads"];

function isBackendRequest(url: string): boolean {
  return BACKEND_PATH_PREFIXES.some(
    (prefix) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`),
  );
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devPort = Number(env.PORT) || 3500;
  const apiProxyTarget =
    env.API_PROXY_TARGET?.replace(/\/$/, "") || `http://127.0.0.1:${devPort}`;
  const previewPort = Number(env.WEB_PREVIEW_PORT) || 4173;

  const apiProxy = {
    target: apiProxyTarget,
    changeOrigin: true,
    secure: false,
  };

  return {
    server: {
      host: "0.0.0.0",
      port: devPort,
      fs: {
        allow: [".", "./client", "./shared"],
        deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
      },
    },
    preview: {
      host: "0.0.0.0",
      port: previewPort,
      // Simule takymed.com sur IONOS : SPA statique + /api et /uploads proxifiés
      proxy: {
        "/api": apiProxy,
        "/uploads": apiProxy,
      },
    },
    build: {
      outDir: "dist/spa",
    },
    plugins: [react(), expressPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./client"),
        "@shared": path.resolve(__dirname, "./shared"),
      },
    },
  };
});

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    configureServer(server) {
      const { createServer } = require("./server");
      const app = createServer();

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (isBackendRequest(url)) {
          app(req, res, next);
          return;
        }
        next();
      });
    },
  };
}
