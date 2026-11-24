import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/systemlab/" : "/",
  plugins: [react(), tailwind()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/recharts/")) return "charts";
          if (id.includes("/node_modules/@xyflow/")) return "canvas";
        },
      },
    },
  },
}));
