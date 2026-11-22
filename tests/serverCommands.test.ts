import { describe, it, expect, afterEach } from 'vitest';
import { startEmbeddedDesktopServer, EmbeddedServerHandle } from '../src/server/electronEntry';
import path from 'node:path';

describe('Embedded Desktop Express Server (electronEntry)', () => {
  let handle: EmbeddedServerHandle | null = null;

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = null;
    }
  });

  it('starts on an ephemeral port, responds cleanly to /api/health, and closes', async () => {
    handle = await startEmbeddedDesktopServer({
      distDir: path.resolve(process.cwd(), 'dist'),
      preferredPort: 0,
    });

    expect(handle.port).toBeGreaterThan(0);
    expect(handle.url).toBe(`http://127.0.0.1:${handle.port}`);

    const res = await fetch(`${handle.url}/api/health`);
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { ok?: boolean; status?: string };
    expect(data.ok).toBe(true);
  });
});
