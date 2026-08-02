import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  // Deployed at a domain root on Vercel, so assets resolve from "/".
  base: "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // ethers is a third of the bundle and changes far less often than the
        // app does, so it earns its own long-lived cache entry.
        manualChunks: {
          ethers: ["ethers"],
          react: ["react", "react-dom", "react-router-dom"],
          qr: ["qrcode", "jsqr"],
        },
      },
    },
  },
}));
