import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';

function getPagesEntries() {
  const pagesDir = resolve(__dirname, 'pages');
  return readdirSync(pagesDir)
    .filter(f => f.endsWith('.html'))
    .map(f => resolve(pagesDir, f));
}

export default defineConfig({
  root: '.',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...Object.fromEntries(
          readdirSync(resolve(__dirname, 'pages'))
            .filter(f => f.endsWith('.html'))
            .map(f => [f.replace('.html', ''), resolve(__dirname, 'pages', f)])
        ),
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
