import { describe, it, expect } from 'vitest';
import {
  ALLOWED_PLAYER_ORIGINS,
  validateAndParseWatchlistImport,
  parseVerifiedPlayerMessage,
  getUtcDateKey,
  createFreshDailyQuests,
  computeEpisodeMetadata,
} from '../src/utils/validation';
import {
  buildStrictStreamUrl,
  getServerDisplayName,
  resolveBestAvailableStream,
  STREAMING_SERVERS,
} from '../src/services/megaplay';
import { AnimeMedia } from '../src/types/anime';
import {
  OFFICIAL_MIRRORS,
  PRIMARY_PRODUCTION_URL,
  normalizeDeploymentUrl,
} from '../src/services/deploymentUrl';

describe('Watchlist Import Validation', () => {
  it('validates clean entries and deduplicates by anime ID', () => {
    const payload = JSON.stringify([
      {
        anime: {
          id: 154587,
          idMal: 52991,
          title: { romaji: 'Sousou no Frieren', english: 'Frieren' },
          genres: ['Fantasy'],
        },
        status: 'watching',
        currentEpisode: 3,
        totalEpisodes: 28,
        progressPercent: 11,
        isFavorite: false,
        updatedAt: 1000,
      },
      {
        anime: {
          id: 154587,
          idMal: 52991,
          title: { romaji: 'Sousou no Frieren', english: 'Frieren' },
          genres: ['Fantasy'],
        },
        status: 'watching',
        currentEpisode: 5,
        totalEpisodes: 28,
        progressPercent: 18,
        isFavorite: true,
        updatedAt: 2000,
      },
    ]);

    const res = validateAndParseWatchlistImport(payload);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.entries).toHaveLength(1);
      expect(res.entries[0].currentEpisode).toBe(5);
      expect(res.entries[0].isFavorite).toBe(true);
    }
  });

  it('rejects malformed JSON and corrupted entries missing required fields', () => {
    expect(validateAndParseWatchlistImport('{bad json').ok).toBe(false);
    expect(validateAndParseWatchlistImport(JSON.stringify([{ bad: true }])).ok).toBe(false);
  });
});

describe('Verified Player PostMessage Security', () => {
  it('rejects messages from untrusted origins or mismatched window sources', () => {
    const fakeWin = {} as Window;
    const otherWin = {} as Window;

    const badOrigin = {
      origin: 'https://evil-site.example',
      data: { type: 'ended' },
      source: fakeWin,
    } as unknown as MessageEvent;
    expect(parseVerifiedPlayerMessage(badOrigin, fakeWin)).toBeNull();

    const badSource = {
      origin: 'https://anixo.buzz',
      data: { type: 'ended' },
      source: otherWin,
    } as unknown as MessageEvent;
    expect(parseVerifiedPlayerMessage(badSource, fakeWin)).toBeNull();

    const invalidSchema = {
      origin: 'https://anixo.buzz',
      data: { type: 'arbitrary_unknown_event' },
      source: fakeWin,
    } as unknown as MessageEvent;
    expect(parseVerifiedPlayerMessage(invalidSchema, fakeWin)).toBeNull();

    const validMsg = {
      origin: 'https://megaplay.buzz',
      data: { type: 'timeupdate', data: { currentTime: 420, duration: 1420 } },
      source: fakeWin,
    } as unknown as MessageEvent;
    const parsed = parseVerifiedPlayerMessage(validMsg, fakeWin);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('timeupdate');
    expect(parsed?.data?.currentTime).toBe(420);
  });
});

describe('Daily Quests & Episode Metadata Rules', () => {
  it('stamps UTC dateKey on daily quests for reliable date-based resets', () => {
    const dateKey = getUtcDateKey(new Date('2026-04-01T23:59:00Z'));
    expect(dateKey).toBe('2026-04-01');
    const quests = createFreshDailyQuests(dateKey);
    expect(quests.length).toBeGreaterThanOrEqual(3);
    expect(quests.every((q) => q.dateKey === '2026-04-01' && q.current === 0 && !q.claimed)).toBe(
      true
    );
  });

  it('handles movies and unknown episode counts accurately without falling back to 12', () => {
    const movie: AnimeMedia = {
      id: 1,
      title: { romaji: 'Your Name' },
      coverImage: {},
      genres: ['Romance'],
      format: 'MOVIE',
      episodes: null,
    };
    expect(computeEpisodeMetadata(movie)).toEqual({
      totalEpisodes: 1,
      episodesUnknown: false,
      isMovie: true,
      displayTotalLabel: 'Movie',
    });

    const ongoingUnknown: AnimeMedia = {
      id: 2,
      title: { romaji: 'One Piece' },
      coverImage: {},
      genres: ['Action'],
      format: 'TV',
      episodes: null,
    };
    const meta = computeEpisodeMetadata(ongoingUnknown);
    expect(meta.totalEpisodes).toBeNull();
    expect(meta.episodesUnknown).toBe(true);
    expect(meta.displayTotalLabel).toBe('Ongoing');
  });
});

describe('Strict Streaming Server & Auto-Failover Logic', () => {
  it('refuses MAL-only servers when idMal is absent and auto-fails over to AniList-native mirrors', () => {
    const strictBlocked = buildStrictStreamUrl({
      serverId: 'megaplay-mal',
      anilistId: 154587,
      malId: null,
      episode: 4,
      audio: 'sub',
    });
    expect(strictBlocked.available).toBe(false);
    expect(strictBlocked.url).toBeNull();

    const failover = resolveBestAvailableStream({
      serverId: 'zokoanime',
      anilistId: 154587,
      malId: null,
      episode: 4,
      audio: 'sub',
    });
    expect(failover.available).toBe(true);
    expect(failover.usedFailover).toBe(true);
    expect(failover.effectiveServerId).toBe('anixo');
    expect(failover.url).toContain('https://anixo.buzz/embed/ani/154587/4');
  });

  it('builds verified endpoints for Ryu, War, Warp, and Volt with renamed labels', () => {
    expect(STREAMING_SERVERS.map((s) => s.badge)).toEqual(['Ryu', 'War', 'Warp', 'Volt']);
    expect(getServerDisplayName('anixo')).toBe('Ryu');
    expect(getServerDisplayName('animeembed')).toBe('War');
    expect(getServerDisplayName('megaplay-mal')).toBe('Warp');
    expect(getServerDisplayName('zokoanime')).toBe('Volt');

    const ryuStream = buildStrictStreamUrl({
      serverId: 'anixo',
      anilistId: 154587,
      malId: 52991,
      episode: 2,
      audio: 'sub',
    });
    expect(ryuStream.available).toBe(true);
    expect(ryuStream.url).toContain('https://anixo.buzz/embed/ani/154587/2?track=sub');

    const warStream = buildStrictStreamUrl({
      serverId: 'animeembed',
      anilistId: 154587,
      malId: 52991,
      episode: 2,
      audio: 'dub',
    });
    expect(warStream.available).toBe(true);
    expect(warStream.url).toContain('https://animeembed.com/embed/ani/154587/2?track=dub&accent=');
    expect(warStream.url).toContain('autoPlay=1');
    expect(ALLOWED_PLAYER_ORIGINS.has('https://animeembed.com')).toBe(true);

    const warpStream = buildStrictStreamUrl({
      serverId: 'megaplay-mal',
      anilistId: 154587,
      malId: 52991,
      episode: 2,
      audio: 'dub',
    });
    expect(warpStream.available).toBe(true);
    expect(warpStream.url).toContain('https://megaplay.buzz/stream/mal/52991/2/dub');

    const voltStream = buildStrictStreamUrl({
      serverId: 'zokoanime',
      anilistId: 154587,
      malId: 52991,
      episode: 2,
      audio: 'sub',
    });
    expect(voltStream.available).toBe(true);
    expect(voltStream.url).toContain('https://zokoanime.video/stream/mal/52991/2/sub');
  });
});

describe('Official KuroStream Mirror Registry', () => {
  it('registers the primary production site plus 5 Netlify and 5 Vercel mirrors', () => {
    expect(PRIMARY_PRODUCTION_URL).toBe('https://kurostream-app.netlify.app');
    const mirrors = OFFICIAL_MIRRORS.filter((m) => m.role === 'Mirror');
    expect(mirrors.map((m) => m.url)).toEqual([
      'https://kurostream-m1.netlify.app',
      'https://kurostream-m2.netlify.app',
      'https://kurostream-m3.netlify.app',
      'https://kurostream-m4.netlify.app',
      'https://kurostream-m5.netlify.app',
      'https://kurostream-m1.vercel.app',
      'https://kurostream-m2.vercel.app',
      'https://kurostream-m3.vercel.app',
      'https://kurostream-m4.vercel.app',
      'https://kurostream-m5.vercel.app',
    ]);
  });

  it('normalizes trailing slashes and rejects insecure external HTTP URLs', () => {
    expect(normalizeDeploymentUrl('https://kurostream-m1.netlify.app///')).toBe(
      'https://kurostream-m1.netlify.app'
    );
    expect(normalizeDeploymentUrl('http://insecure-example.com')).toBeNull();
    expect(normalizeDeploymentUrl('http://localhost:3000/test')).toBe('http://localhost:3000');
  });
});
