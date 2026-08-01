import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    // Only our own tests. Without this, vitest also collects the Hardhat suites
    // vendored inside Backend-Contracts/lib/openzeppelin-contracts.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
  },
});
