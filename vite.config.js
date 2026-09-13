import { defineConfig } from "vite";

const atlasProxy = {
  "/gebco": {
    target: "https://wms.gebco.net",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/gebco/, ""),
    configure: (proxy) => {
      proxy.on("proxyRes", (proxyRes) => {
        delete proxyRes.headers["content-security-policy"];
      });
    },
  },
  "/gmrt": {
    target: "https://www.gmrt.org",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/gmrt/, ""),
  },
  "/hycom": {
    target: "https://ncss.hycom.org",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/hycom/, ""),
  },
};

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: atlasProxy,
  },
  preview: {
    port: 4173,
    host: true,
    proxy: atlasProxy,
  },
});
