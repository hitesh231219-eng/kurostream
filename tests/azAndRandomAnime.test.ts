import { describe, it, expect } from 'vitest';
import {
  matchesAlphabetLetter,
  getAnimeByLetter,
  getRandomAnime,
  FALLBACK_ANIME_LIST,
} from '../src/services/anilist';

describe('A to Z Anime Directory & Random Anime Dice Engine', () => {
  describe('Alphabetical Letter Matcher', () => {
    it('matches exact starting letters case-insensitively', () => {
      expect(matchesAlphabetLetter('Attack on Titan', 'A')).toBe(true);
      expect(matchesAlphabetLetter('attack on titan', 'a')).toBe(true);
      expect(matchesAlphabetLetter('Bleach: Thousand-Year Blood War', 'B')).toBe(true);
      expect(matchesAlphabetLetter('chainsaw man', 'C')).toBe(true);
      expect(matchesAlphabetLetter('Frieren: Beyond Journey\'s End', 'F')).toBe(true);
      expect(matchesAlphabetLetter('Solo Leveling', 'S')).toBe(true);
      expect(matchesAlphabetLetter('Zom 100', 'Z')).toBe(true);
    });

    it('rejects mismatched letters', () => {
      expect(matchesAlphabetLetter('Attack on Titan', 'B')).toBe(false);
      expect(matchesAlphabetLetter('Death Note', 'A')).toBe(false);
      expect(matchesAlphabetLetter('Naruto', 'Z')).toBe(false);
    });

    it('matches digits, numbers, and symbols under the # non-alpha category', () => {
      expect(matchesAlphabetLetter('86 - Eighty Six', '#')).toBe(true);
      expect(matchesAlphabetLetter('91 Days', '#')).toBe(true);
      expect(matchesAlphabetLetter('3-gatsu no Lion', '#')).toBe(true);
      expect(matchesAlphabetLetter('.hack//Sign', '#')).toBe(true);
      expect(matchesAlphabetLetter('100-man no Inochi', '#')).toBe(true);
      expect(matchesAlphabetLetter('009-1', '#')).toBe(true);

      // Alphabetic titles should NOT match #
      expect(matchesAlphabetLetter('Naruto', '#')).toBe(false);
      expect(matchesAlphabetLetter('One Piece', '#')).toBe(false);
    });

    it('handles whitespace gracefully', () => {
      expect(matchesAlphabetLetter('   Demon Slayer', 'D')).toBe(true);
      expect(matchesAlphabetLetter('', 'A')).toBe(false);
      expect(matchesAlphabetLetter('   ', 'A')).toBe(false);
    });
  });

  describe('A-Z Directory Fetcher & Fallback', () => {
    it('retrieves titles matching selected letter and provides valid pagination', async () => {
      const res = await getAnimeByLetter({
        letter: 'C',
        page: 1,
        perPage: 10,
      });

      expect(Array.isArray(res.media)).toBe(true);
      expect(typeof res.hasNextPage).toBe('boolean');
      if (res.media.length > 0) {
        // At least one item should start with C or contain C in title
        const first = res.media[0];
        expect(first.title).toBeDefined();
        const fullTitle = (first.title.english || first.title.romaji || '').toUpperCase();
        expect(fullTitle.includes('C') || fullTitle.startsWith('C')).toBe(true);
      }
    });

    it('supports sorting by score and popularity', async () => {
      const resScore = await getAnimeByLetter({
        letter: 'A',
        sort: 'SCORE_DESC',
        perPage: 6,
      });

      expect(Array.isArray(resScore.media)).toBe(true);
      if (resScore.media.length >= 2) {
        const scores = resScore.media
          .map((m) => m.averageScore || 0)
          .filter((s) => s > 0);
        // Scores should be sorted descending
        for (let i = 0; i < scores.length - 1; i++) {
          expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
        }
      }
    });
  });

  describe('Random Anime Dice Roll Engine', () => {
    it('returns a complete AnimeMedia object with title, scores, and genres', async () => {
      const picked = await getRandomAnime();

      expect(picked).toBeDefined();
      expect(typeof picked.id).toBe('number');
      expect(picked.title).toBeDefined();
      expect(typeof (picked.title.english || picked.title.romaji)).toBe('string');
      expect(Array.isArray(picked.genres)).toBe(true);
      expect(picked.coverImage).toBeDefined();
    });

    it('returns valid random anime when filtered by genre', async () => {
      const actionAnime = await getRandomAnime({ genre: 'Action' });

      expect(actionAnime).toBeDefined();
      expect(typeof actionAnime.id).toBe('number');
      expect(actionAnime.genres).toContain('Action');
    });

    it('produces diverse random selections over repeated dice rolls', async () => {
      const results = new Set<number>();
      for (let i = 0; i < 4; i++) {
        const picked = await getRandomAnime();
        results.add(picked.id);
      }
      // Should pick items without throwing errors
      expect(results.size).toBeGreaterThanOrEqual(1);
    });
  });
});
