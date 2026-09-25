import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    server: {
      deps: {
        // ngx-filesaver's ESM build does a named import from the CommonJS
        // file-saver, which Node's own loader rejects; let Vite transform it.
        inline: ['ngx-filesaver'],
      },
    },
  },
});
