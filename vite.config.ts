import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: "client",
  build: { outDir: "../dist", emptyOutDir: true, target: "es2020" },
  server: {
    host: true,
    proxy: { "/api": "http://localhost:8787", "/beckn": "http://localhost:8787" },
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Hunar Setu",
        short_name: "Hunar Setu",
        description: "Your voice guide from learning to livelihood",
        theme_color: "#0b6e4f",
        background_color: "#fffaf2",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        // App shell + knowledge base are precached, so discovery, eligibility,
        // offer checks and the cost calculator all work with no signal.
        globPatterns: ["**/*.{js,css,html,svg,json,webmanifest}"],
        navigateFallbackDenylist: [/^\/api/, /^\/beckn/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/kb"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "kb" },
          },
        ],
      },
    }),
  ],
});
