import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        exclude: [
          "src/generated/**",
          "src/components/ui/**",
          "src/routeTree.gen.ts",
          "src/routes/**",
          "**/*.d.ts",
          "src/test/**",
          "src/main.tsx",
        ],
      },
    },
  })
);
