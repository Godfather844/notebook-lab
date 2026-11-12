import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" → dist works when opened directly (file://) as well as served
export default defineConfig({
  base: "./",
  plugins: [react()],
});
