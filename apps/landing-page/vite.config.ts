/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { generateStaticFiles } from './src/utils/ssg';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/landing-page',
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4200,
    host: 'localhost',
  },
  define: {
    // Inject environment variables for client-side access
    __VITE_SANITY_API_VERSION__: JSON.stringify(
      process.env.VITE_SANITY_API_VERSION || '2024-01-22'
    ),
    __VITE_SANITY_DATASET__: JSON.stringify(
      process.env.VITE_SANITY_DATASET || 'production'
    ),
    __VITE_SANITY_PROJECT_ID__: JSON.stringify(
      process.env.VITE_SANITY_PROJECT_ID || '4cam5qzc'
    ),
  },
  plugins: [
    react(),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md', '*.json']),
    // Custom plugin to generate SEO files
    {
      name: 'generate-seo-files',
      writeBundle: async options => {
        if (options.dir) {
          try {
            await generateStaticFiles(options.dir);
          } catch (error) {
            console.error('Failed to generate SEO files:', error);
          }
        }
      },
    },
  ],
  build: {
    outDir: '../../dist/apps/landing-page',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
