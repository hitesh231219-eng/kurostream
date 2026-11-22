import { describe, it, expect, vi, afterEach } from 'vitest';
import { WatchPartyHub } from '../src/server/watchPartyHub';

const sampleAnime = {
  id: 154587,
  idMal: 52991,
  title: { romaji: 'Sousou no Frieren', english: 'Frieren' },
  coverImage: { large: 'https://s4.anilist.co/cover.jpg' },
  genres: ['Fantasy'],
};

describe('WatchPartyHub Server Authority & Sync', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates valid rooms, returns null for unknown rooms, and enforces host token authorization', () => {
    const hub = new WatchPartyHub();
    const created = hub.createRoom({
      roomName: 'Friday Stream',
      hostId: 'uid-host-1',
      hostName: 'Alex',
      anime: sampleAnime,
      episode: 3,
      server: 'anixo',
      audio: 'sub',
    });

    expect(created.room.roomId).toMatch(/^KURO-[A-F0-9]{6}$/);
    expect(created.hostToken.length).toBeGreaterThanOrEqual(16);
    expect(hub.getRoom('INVALID-999')).toBeNull();
    expect(hub.getRoom(created.room.roomId)).not.toBeNull();

    const forbidden = hub.applyHostControl(created.room.roomId, 'wrong-token', {
      type: 'play',
      seekTime: 120,
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.status).toBe(403);
    }

    const allowed = hub.applyHostControl(created.room.roomId, created.hostToken, {
      type: 'play',
      seekTime: 120,
    });
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.room.isPlaying).toBe(true);
      expect(allowed.room.seekTime).toBeGreaterThanOrEqual(120);
    }
  });

  it('deduplicates repeated chat clientMsgId events and expires stale rooms by TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00Z'));

    const hub = new WatchPartyHub();
    const created = hub.createRoom({
      roomName: 'Sync Room',
      hostId: 'h1',
      hostName: 'Host',
      anime: sampleAnime,
      episode: 1,
      server: 'anixo',
      audio: 'sub',
    });

    const first = hub.postChatMessage(created.room.roomId, {
      clientMsgId: 'msg-unique-1',
      senderId: 'u1',
      senderName: 'Viewer',
      senderAvatar: '',
      text: 'Hello everyone!',
    });
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.deduplicated).toBe(false);

    const dup = hub.postChatMessage(created.room.roomId, {
      clientMsgId: 'msg-unique-1',
      senderId: 'u1',
      senderName: 'Viewer',
      senderAvatar: '',
      text: 'Hello everyone!',
    });
    expect(dup.ok).toBe(true);
    if (dup.ok) expect(dup.deduplicated).toBe(true);

    // Advance past 6 hour TTL
    vi.advanceTimersByTime(6 * 60 * 60 * 1000 + 5000);
    expect(hub.getRoom(created.room.roomId)).toBeNull();
    expect(hub.activeRoomCount).toBe(0);
  });
});
