import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { attachWatchPartyWebSocket, createKuroStreamApp } from './app';

export interface EmbeddedServerHandle {
  port: number;
  url: string;
  close: () => Promise<void>;
}

function listenOnPort(server: http.Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve(addr.port);
      } else {
        resolve(port);
      }
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

export async function startEmbeddedDesktopServer(options: {
  distDir: string;
  preferredPort?: number;
}): Promise<EmbeddedServerHandle> {
  const { app, hub } = createKuroStreamApp();
  const server = http.createServer(app);

  attachWatchPartyWebSocket(server, hub);

  const distDir = path.resolve(options.distDir);
  app.use(express.static(distDir, { index: false }));

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    return res.sendFile(path.join(distDir, 'index.html'));
  });

  const pruneTimer = setInterval(() => hub.pruneExpiredRooms(), 10 * 60 * 1000);
  if (typeof pruneTimer.unref === 'function') {
    pruneTimer.unref();
  }

  const preferred = options.preferredPort ?? 38421;
  let actualPort: number;
  try {
    actualPort = await listenOnPort(server, preferred);
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE' && preferred !== 0) {
      actualPort = await listenOnPort(server, 0);
    } else {
      throw err;
    }
  }

  return {
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}`,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(pruneTimer);
        server.close(() => resolve());
      }),
  };
}
