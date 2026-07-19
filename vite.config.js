/**
 * @file vite.config.js
 * @description Vite build configuration for Vela Chrome Extension.
 *
 * Uses vite-plugin-web-extension which:
 *   - Reads manifest.json and automatically bundles all referenced files
 *   - Handles content scripts, background service workers, and sidebar HTML
 *   - Outputs a ready-to-load unpacked extension into /dist
 *
 * Build output: /dist (load this folder as unpacked extension in Chrome)
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src',

  plugins: [
    react(),
    webExtension({
      manifest: path.resolve(__dirname, 'manifest.json'),
      watchFilePaths: ['src/**/*', 'manifest.json'],
      disableAutoLaunch: true,
    }),
  ],

  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@background': path.resolve(__dirname, 'src/background'),
      '@content': path.resolve(__dirname, 'src/content'),
      '@sidebar': path.resolve(__dirname, 'src/sidebar'),
    },
  },

  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: process.env.NODE_ENV === 'production',
    rollupOptions: {
      output: {
        // Deterministic chunk naming — important for extension loading
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  define: {
    // Expose env variables to the extension bundle
    __DEV__: process.env.NODE_ENV !== 'production',
    __VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
  },
});
