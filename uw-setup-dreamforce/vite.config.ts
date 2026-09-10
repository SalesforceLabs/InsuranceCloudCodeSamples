import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, 'data/setup/config.json');

function configApiPlugin(): Plugin {
  async function readConfig(): Promise<unknown> {
    if (!existsSync(CONFIG_PATH)) return {};
    const raw = await readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(raw || '{}');
  }
  async function writeConfig(data: unknown): Promise<void> {
    await mkdir(dirname(CONFIG_PATH), { recursive: true });
    await writeFile(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
  }
  return {
    name: 'config-api',
    configureServer(server) {
      server.middlewares.use('/api/setup/config', async (req, res) => {
        try {
          if (req.method === 'GET') {
            const data = await readConfig();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return;
          }
          if (req.method === 'POST' || req.method === 'PUT') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const body = Buffer.concat(chunks).toString('utf8');
            const parsed = body ? JSON.parse(body) : {};
            await writeConfig(parsed);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          res.statusCode = 405;
          res.end('Method Not Allowed');
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
    },
  };
}

// After the static build, drop files into the output dir for GitHub Pages:
//   404.html    — copy of index.html so SPA deep-link refreshes boot the app.
//   .nojekyll   — stop Pages running Jekyll over the hashed asset filenames.
//   config.json — the seeded setup config, served statically so the deployed
//                 app loads real data (there's no /api/setup/config in prod).
function pagesSpaFallback(outDir: string): Plugin {
  return {
    name: 'pages-spa-fallback',
    apply: 'build',
    async closeBundle() {
      const dir = resolve(__dirname, outDir);
      const html = await readFile(resolve(dir, 'index.html'), 'utf8');
      await writeFile(resolve(dir, '404.html'), html, 'utf8');
      await writeFile(resolve(dir, '.nojekyll'), '', 'utf8');
      await writeFile(resolve(dir, 'config.json'), await readFile(CONFIG_PATH, 'utf8'), 'utf8');
    },
  };
}

const PAGES_OUT_DIR = 'docs';

export default defineConfig(({ command }) => ({
  // GitHub Enterprise Pages serves this project under a subpath; assets must
  // resolve against it. Dev server stays at root so local routing is unchanged.
  base: command === 'build' ? '/pages/nakul-saxena/UW-Setup-V2/' : '/',
  plugins: [react(), configApiPlugin(), pagesSpaFallback(PAGES_OUT_DIR)],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    // Pages "deploy from branch" serves this folder; committing docs/ ships
    // the built app. GitHub Actions isn't available on this Enterprise host.
    outDir: PAGES_OUT_DIR,
  },
  server: {
    port: 3001,
  },
}));
