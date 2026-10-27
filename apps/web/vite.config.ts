import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 4310,
    proxy: {
      "/api": "http://127.0.0.1:4311",
      "/health": "http://127.0.0.1:4311",
    },
  },
});
