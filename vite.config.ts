import { defineConfig } from "vite";

export default defineConfig({
  // Relativ statt "/arcade/": funktioniert sowohl unter
  // felix.github.io/<repo>/ als auch bei npm run preview.
  base: "./",
  build: { target: "es2022" },
});
