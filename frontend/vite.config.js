import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true, // Ensure it uses exactly this port
    open: true // Automatically open the browser when starting
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
