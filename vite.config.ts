import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: 'public',
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          'playcanvas-engine': ['playcanvas'],
          'snap-web-lens-api': ['@snap/web-lens-api']
        }
      }
    }
  }
});
