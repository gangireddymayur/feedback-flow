import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { devServerBridgePlugin } from "@lovable.dev/vite-plugin-dev-server-bridge";
import { hmrGatePlugin } from "@lovable.dev/vite-plugin-hmr-gate";

export default defineConfig({
  plugins: [tailwindcss(), tsconfigPaths(), hmrGatePlugin(), devServerBridgePlugin(), react()],
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
