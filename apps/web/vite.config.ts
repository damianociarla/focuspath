import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/focuspath/" : "/",
  build: {
    rollupOptions: {
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
        docs: new URL("./docs.html", import.meta.url).pathname,
      },
    },
  },
});
