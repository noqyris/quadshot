import { defineConfig } from "vite";

// Quadshot uses a relative base so the built `dist/` works both when served
// from a web host and when bundled into a native Capacitor WebView.
export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2020",
    // No source maps in the shipped bundle: they add ~10MB to each native
    // package and expose readable source. Flip to true locally if you need them.
    sourcemap: false,
    chunkSizeWarningLimit: 1600, // Phaser is a large single dependency
  },
});
