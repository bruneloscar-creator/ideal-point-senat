import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');

await mkdir(resolve(dist, 'server'), { recursive: true });
await mkdir(resolve(dist, '.openai'), { recursive: true });

await writeFile(
  resolve(dist, 'server', 'index.js'),
  `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/data/senators.json') {
      url.pathname = '/assets/senators.json';
      request = new Request(url, request);
    }
    if (url.pathname === '/data/deputies.json') {
      url.pathname = '/assets/deputies.json';
      request = new Request(url, request);
    }
    if (url.pathname.startsWith('/data/deputies/')) {
      url.pathname = url.pathname.replace('/data/deputies/', '/assets/deputies/');
      request = new Request(url, request);
    }
    return env.ASSETS.fetch(request);
  },
};
`,
  'utf8'
);

await copyFile(
  resolve(root, '.openai', 'hosting.json'),
  resolve(dist, '.openai', 'hosting.json')
);
