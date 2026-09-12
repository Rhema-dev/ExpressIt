import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [
    react(),
    {
      name: 'development-csp',
      transformIndexHtml: (html) =>
        command === 'serve'
          ? html
              .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
              .replace("connect-src 'self'", "connect-src 'self' ws://localhost:* ws://127.0.0.1:*")
          : html,
    },
  ],
  build: { target: 'chrome99', outDir: 'dist', emptyOutDir: true },
}));
