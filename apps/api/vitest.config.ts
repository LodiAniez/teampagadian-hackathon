import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC plugin emits decorator metadata (esbuild does not), enabling
// reflection-based NestJS DI in Test.createTestingModule and reducing the
// need for explicit @Inject() decorators on class-typed constructor params.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{spec,test}.ts", "test/**/*.{spec,test}.ts"],
    setupFiles: ["./test/setup.ts"],
    pool: "forks",
  },
  plugins: [
    swc.vite({
      module: { type: "es6" },
    }),
  ],
});
