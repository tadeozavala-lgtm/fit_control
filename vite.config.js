import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Rutas relativas: funciona igual en GitHub Pages (/repo/), Netlify o abierto desde Archivos.
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: true
  },
  plugins: [
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon-180.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Protocolo 4D + 5 Cardio",
        short_name: "4D+5",
        description:
          "Registro de series, pesos y repeticiones con timer de descanso y guías de técnica.",
        start_url: "./index.html",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0F2531",
        theme_color: "#0F2531",
        lang: "es-MX",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // Las fotos de técnica (webp) quedan FUERA del precaché a propósito:
        // son ~3 MB contra los ~100 KB de la app. Instalarla no puede costar
        // eso por unas fotos que se miran de vez en cuando; se guardan la
        // primera vez que se abren y a partir de ahí están offline.
        globPatterns: ["**/*.{js,css,html,png,json,woff2}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/?ejercicios\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/ejercicios/"),
            handler: "CacheFirst",
            options: {
              cacheName: "fotos-ejercicios",
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"]
  }
});
