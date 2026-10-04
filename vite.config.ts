import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import fs from 'node:fs'
import path from 'node:path'

function mockPositionsApiPlugin() {
  return {
    name: 'mock-positions-api',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        if (parsedUrl.pathname === '/positions' && req.method === 'GET') {
          const filePath = path.resolve(process.cwd(), 'src/data/positionsData.json');
          if (!fs.existsSync(filePath)) {
            next();
            return;
          }
          const allPositions = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          const search = parsedUrl.searchParams.get('search')?.toLowerCase();
          const category = parsedUrl.searchParams.get('category');
          const work_mode = parsedUrl.searchParams.get('work_mode');
          const status = parsedUrl.searchParams.get('status');
          const company_id = parsedUrl.searchParams.get('company_id');

          let filtered = allPositions;
          if (search) {
            filtered = filtered.filter((p: any) =>
              (p.title && p.title.toLowerCase().includes(search)) ||
              (p.company_name && p.company_name.toLowerCase().includes(search)) ||
              (p.company_short_name && p.company_short_name.toLowerCase().includes(search)) ||
              (p.location && p.location.toLowerCase().includes(search)) ||
              (p.description && p.description.toLowerCase().includes(search))
            );
          }
          if (category) {
            filtered = filtered.filter((p: any) => p.category === category);
          }
          if (work_mode) {
            filtered = filtered.filter((p: any) => p.work_mode === work_mode);
          }
          if (status) {
            filtered = filtered.filter((p: any) => p.status === status);
          }
          if (company_id) {
            filtered = filtered.filter((p: any) => p.company_id === company_id);
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.statusCode = 200;
          res.end(JSON.stringify(filtered));
          return;
        }

        const matchItem = parsedUrl.pathname.match(/^\/positions\/([A-Za-z0-9_-]+)$/);
        if (matchItem && req.method === 'GET') {
          const posId = matchItem[1];
          const filePath = path.resolve(process.cwd(), 'src/data/positionsData.json');
          const allPositions = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : [];
          const item = allPositions.find((p: any) => p.position_id === posId);
          if (item) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 200;
            res.end(JSON.stringify(item));
          } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 404;
            res.end(JSON.stringify({ error: `Position ${posId} not found` }));
          }
          return;
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    mockPositionsApiPlugin(),
  ],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 4173,
    allowedHosts: true,
  },
})

