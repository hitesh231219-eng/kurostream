import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { createKuroStreamApp, attachWatchPartyWebSocket } from '../src/server/app';

describe('KuroStream Backend API & WebSocket Integration', () => {
  let server: http.Server;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    const { app, hub } = createKuroStreamApp();
    server = http.createServer(app);
    attachWatchPartyWebSocket(server, hub);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    wsUrl = `ws://127.0.0.1:${addr.port}/ws/party`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('serves /api/health and enforces SSRF blocking on /api/manga-proxy', async () => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.ok).toBe(true);
    expect(healthJson.service).toBe('kurostream-api');

    const blockedUrls = [
      'http://uploads.mangadex.org/test.png',
      'https://127.0.0.1/secret',
      'https://169.254.169.254/latest/meta-data/',
      'https://untrusted-domain.example/panel.jpg',
    ];
    for (const target of blockedUrls) {
      const proxyRes = await fetch(`${baseUrl}/api/manga-proxy?url=${encodeURIComponent(target)}`);
      expect(proxyRes.status).toBe(403);
    }
  });

  it('handles Watch Party REST lifecycle and real-time WebSocket synchronization across clients', async () => {
    // Non-existent room rejects cleanly with 404
    const missingRes = await fetch(`${baseUrl}/api/party/rooms/KURO-000000`);
    expect(missingRes.status).toBe(404);

    // Create room
    const createRes = await fetch(`${baseUrl}/api/party/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: 'Integration Test Room',
        hostId: 'host-1',
        hostName: 'HostUser',
        anime: {
          id: 154587,
          idMal: 52991,
          title: { romaji: 'Sousou no Frieren', english: 'Frieren' },
          coverImage: { large: 'https://s4.anilist.co/frieren.jpg' },
          genres: ['Adventure', 'Fantasy'],
        },
        episode: 1,
        server: 'anixo',
        audio: 'sub',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const roomId: string = created.room.roomId;
    const hostToken: string = created.hostToken;

    // Unauthorized control is rejected
    const badCtrl = await fetch(`${baseUrl}/api/party/rooms/${roomId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostToken: 'invalid-token-value', type: 'play', seekTime: 10 }),
    });
    expect(badCtrl.status).toBe(403);

    // Connect two WebSocket clients (Host & Guest)
    const wsHost = new WebSocket(wsUrl);
    const wsGuest = new WebSocket(wsUrl);

    const guestEvents: any[] = [];
    await new Promise<void>((resolve, reject) => {
      let hostReady = false;
      let guestReady = false;

      wsHost.on('open', () => {
        wsHost.send(
          JSON.stringify({
            type: 'JOIN_ROOM',
            roomId,
            participantId: 'host-1',
            participantName: 'HostUser',
            participantAvatar: '',
            hostToken,
          })
        );
      });

      wsHost.on('message', (buf) => {
        const msg = JSON.parse(buf.toString());
        if (msg.type === 'ROOM_SNAPSHOT') {
          expect(msg.isHost).toBe(true);
          hostReady = true;
          if (guestReady) resolve();
        }
      });

      wsGuest.on('open', () => {
        wsGuest.send(
          JSON.stringify({
            type: 'JOIN_ROOM',
            roomId,
            participantId: 'guest-2',
            participantName: 'GuestUser',
            participantAvatar: '',
          })
        );
      });

      wsGuest.on('message', (buf) => {
        const msg = JSON.parse(buf.toString());
        guestEvents.push(msg);
        if (msg.type === 'ROOM_SNAPSHOT') {
          expect(msg.isHost).toBe(false);
          guestReady = true;
          if (hostReady) resolve();
        }
      });

      wsHost.on('error', reject);
      wsGuest.on('error', reject);
    });

    // Host sends PLAY control over WebSocket -> Guest receives synchronized ROOM_STATE
    await new Promise<void>((resolve) => {
      wsGuest.on('message', (buf) => {
        const msg = JSON.parse(buf.toString());
        if (msg.type === 'ROOM_STATE' && msg.payload?.isPlaying === true) {
          expect(msg.payload.seekTime).toBeGreaterThanOrEqual(45);
          resolve();
        }
      });

      wsHost.send(
        JSON.stringify({
          type: 'HOST_CONTROL',
          hostToken,
          controlType: 'play',
          seekTime: 45,
        })
      );
    });

    wsHost.close();
    wsGuest.close();
  });

  it('validates 17 U.S.C. § 512(c)(3) DMCA notices and updates compliance delist registry', async () => {
    // Reject incomplete notice (missing sworn confirmations)
    const invalidRes = await fetch(`${baseUrl}/api/dmca/notice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimantName: 'Rights Holder Agent',
        email: 'legal@studio.example',
        workTitle: 'Example Anime',
        infringingUrlOrId: '/anime/154587',
        electronicSignature: '/s/ Rights Holder Agent',
        goodFaithStatement: false,
        accuracyUnderPerjury: true,
      }),
    });
    expect(invalidRes.status).toBe(400);

    // Accept complete statutory notice and immediately mark AniList ID delisted
    const validRes = await fetch(`${baseUrl}/api/dmca/notice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimantName: 'Rights Holder Agent',
        organization: 'Studio Compliance Dept',
        email: 'legal@studio.example',
        workTitle: 'Frieren',
        infringingUrlOrId: 'https://kurostream.example/anime/154587',
        electronicSignature: '/s/ Rights Holder Agent',
        goodFaithStatement: true,
        accuracyUnderPerjury: true,
      }),
    });
    expect(validRes.status).toBe(201);
    const validJson = await validRes.json();
    expect(validJson.ok).toBe(true);
    expect(validJson.caseId).toMatch(/^KS-DMCA-/);
    expect(validJson.delistedMediaId).toBe(154587);

    // Confirm /api/compliance/status reflects delisted ID
    const statusRes = await fetch(`${baseUrl}/api/compliance/status?anilistId=154587`);
    expect(statusRes.status).toBe(200);
    const statusJson = await statusRes.json();
    expect(statusJson.delisted).toBe(true);
    expect(statusJson.safeHarborFramework).toBe('17 U.S.C. § 512(d)');
  });
});
