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
        // app does, so it earns its own long-lived cache entry. Written as a
        // function rather than a map because rolldown only accepts that form.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/(ethers|@noble|@adraffy)\//.test(id)) return "ethers";
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "react";
          if (/node_modules\/(qrcode|jsqr)\//.test(id)) return "qr";
        },
      },
    },
  },
}));
