import { defineConfig } from 'vite';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 3000, strictPort: true },
  preview: { host: '127.0.0.1', port: 3000, strictPort: true },
  plugins: [
    {
      name: 'tony-offline',
      async closeBundle() {
        const root = resolve('dist'),
          files = [];
        async function walk(path, prefix = '') {
          for (const entry of await readdir(path, { withFileTypes: true })) {
            const name = prefix + entry.name;
            if (entry.isDirectory()) await walk(resolve(path, entry.name), name + '/');
            else if (name !== 'sw.js') files.push(name);
          }
        }
        await walk(root);
        const hash = createHash('sha256');
        for (const name of files) hash.update(await readFile(resolve(root, name)));
        const cache = 'tony-' + hash.digest('hex').slice(0, 12);
        const template = await readFile(resolve('src/pwa/service-worker.js'), 'utf8');
        await writeFile(
          resolve(root, 'sw.js'),
          template
            .replace("'__TONY_CACHE__'", JSON.stringify(cache))
            .replace('__TONY_FILES__', JSON.stringify(files)),
        );
      },
    },
  ],
});
