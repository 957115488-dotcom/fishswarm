import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: [".monkeycode-ai.online"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3767",
        changeOrigin: true
      },
      "/health": {
        target: "http://127.0.0.1:3767",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
