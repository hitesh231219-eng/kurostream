import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { attachWatchPartyWebSocket, createKuroStreamApp } from './src/server/app';

const rawPort = Number(process.env.PORT);
const PORT = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 3000;
const IS_PROD = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

async function startServer() {
  const { app, hub } = createKuroStreamApp();
  const server = http.createServer(app);

  // Mount WebSocket server on /ws/party
  attachWatchPartyWebSocket(server, hub);

  if (!IS_PROD) {
    const hmrEnabled = process.env.DISABLE_HMR !== 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: hmrEnabled ? { server } : false,
        hmr: hmrEnabled,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtml = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      throw new Error(
        'Production bundle not found (dist/index.html missing). Run "npm run build" before "npm start".'
      );
    }
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(indexHtml);
    });
  }

  // Periodically prune expired watch party rooms
  setInterval(() => hub.pruneExpiredRooms(), 10 * 60 * 1000).unref();

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[KuroStream] Port ${PORT} is already in use. Stop the other process or set PORT=3001 in .env.\n`
      );
      process.exit(1);
    }
    console.error('[KuroStream] Server error:', err);
    process.exit(1);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`KuroStream full-stack server listening on http://localhost:${PORT} (0.0.0.0:${PORT})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KuroStream server:', err);
  process.exit(1);
});
