import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { basename } from 'node:path';

function runtimeAssets() {
  return {
    name: 'runtime-assets',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname;
        let source = null;
        let contentType = null;
        if (pathname === '/assets/senators.json' || pathname === '/data/senators.json') {
          source = resolve(__dirname, 'public/data/senators.json');
          contentType = 'application/json; charset=utf-8';
        } else if (pathname.startsWith('/textures/')) {
          source = resolve(__dirname, 'public/textures', basename(pathname));
          contentType = 'image/jpeg';
        } else if (pathname === '/og.png') {
          source = resolve(__dirname, 'public/og.png');
          contentType = 'image/png';
        } else if (pathname === '/preview-hemicycle.png') {
          source = resolve(__dirname, 'public/preview-hemicycle.png');
          contentType = 'image/png';
        }
        if (!source) return next();
        try {
          const body = await readFile(source);
          res.statusCode = 200;
          res.setHeader('Content-Type', contentType);
          res.end(body);
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      const clientDir = resolve(__dirname, 'dist/client');
      await mkdir(resolve(clientDir, 'assets'), { recursive: true });
      await cp(
        resolve(__dirname, 'public/data/senators.json'),
        resolve(clientDir, 'assets/senators.json')
      );
      await cp(resolve(__dirname, 'public/textures'), resolve(clientDir, 'textures'), {
        recursive: true,
      });
      await cp(resolve(__dirname, 'public/og.png'), resolve(clientDir, 'og.png'));
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [runtimeAssets()],
  server: {
    open: false,
    watch: {
      ignored: ['**/_recovery/**', '**/dist/**', '**/public/**'],
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
      },
    },
  },
});
