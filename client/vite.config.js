import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },

  server: {
    port: 5173,
    host: true,
    proxy: {
      "/signal": {
        target: "ws://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: 4173,
    host: true,
  },
});
