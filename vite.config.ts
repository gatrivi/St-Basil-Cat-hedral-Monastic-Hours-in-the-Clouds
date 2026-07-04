import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';

function versionJsonPlugin() {
  let version = '0.0.0';
  return {
    name: 'version-json',
    configResolved() {
      try {
        version = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version;
      } catch {
        /* ignore */
      }
    },
    configureServer(server: { middlewares: { use: (path: string, fn: (req: unknown, res: { setHeader: (k: string, v: string) => void; end: (b: string) => void }) => void) => void } }) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ version, builtAt: new Date().toISOString() }));
      });
    },
    writeBundle(options: { dir?: string }) {
      const out = options.dir || 'dist';
      writeFileSync(
        resolve(out, 'version.json'),
        JSON.stringify({ version, builtAt: new Date().toISOString() }, null, 2)
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), versionJsonPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''),
      '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '1.2.0'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
