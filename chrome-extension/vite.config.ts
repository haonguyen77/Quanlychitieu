import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

// Plugin to copy extension files (manifest, background, icons) to dist
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(distDir, 'manifest.json')
      );

      // Copy background.js
      copyFileSync(
        resolve(__dirname, 'public', 'background.js'),
        resolve(distDir, 'background.js')
      );

      // Copy icons
      const iconsDir = resolve(distDir, 'icons');
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true });
      }
      const srcIcons = resolve(__dirname, 'public', 'icons');
      if (existsSync(srcIcons)) {
        for (const file of readdirSync(srcIcons)) {
          if (file.endsWith('.png')) {
            copyFileSync(resolve(srcIcons, file), resolve(iconsDir, file));
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  base: './', // Relative paths for Chrome Extension
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
