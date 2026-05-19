import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{spec,test}.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
  },
});
