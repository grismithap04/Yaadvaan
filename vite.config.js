import { defineConfig } from "vite";

export default defineConfig({
  server: {
    headers: {
      /*
        Required by SQLite WASM + OPFS.
      */

      "Cross-Origin-Opener-Policy": "same-origin",

      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },

  optimizeDeps: {
    /*
      SQLite WASM should not be
      pre-bundled by Vite.
    */

    exclude: ["@sqlite.org/sqlite-wasm"],
  },
});
