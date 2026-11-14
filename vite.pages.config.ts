import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_PAGES": JSON.stringify("true"),
  },
  plugins: [tailwindcss(), viteReact()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@/lib/cloud-state": path.join(rootDir, "src/lib/cloud-state.pages.ts"),
      "@": path.join(rootDir, "src"),
    },
  },
  publicDir: "public",
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(rootDir, "spa/index.html"),
    },
  },
});
