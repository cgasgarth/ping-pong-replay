import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: { emptyOutDir: true, outDir: "../dist", rolldownOptions: { output: { codeSplitting: { groups: [{ name: "three-renderer", test: /three\/build\/three\.module/u, priority: 20, includeDependenciesRecursively: false }, { name: "three-core", test: /three\//u, priority: 10, includeDependenciesRecursively: false }] } } } },
  plugins: [react()],
  root: "app",
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8765" },
    strictPort: true,
  },
});
