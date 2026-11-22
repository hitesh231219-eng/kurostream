import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  UserProfile,
  AnimeCharacterProfile,
  UserBadge,
  UserStats,
  DailyQuest,
  PreferredServerType,
} from '../types/anime';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  validateFirestoreConnection,
} from '../services/firebase';
import { createFreshDailyQuests, getUtcDateKey } from '../utils/validation';

// Verified Official Anime Character Artwork from AniList CDN
export const ANIME_CHARACTERS: AnimeCharacterProfile[] = [
  {
    id: 'luffy',
    name: 'Monkey D. Luffy',
    nativeName: 'モンキー・D・ルフィ',
    series: 'One Piece (Toei Animation / Eiichiro Oda)',
    role: 'Straw Hat Grand Fleet Captain',
    epithet: 'Sun God Nika · Emperor of the Sea',
    voiceActor: 'Mayumi Tanaka (田中 真弓)',
    bountyOrPower: '3,000,000,000 Berries',
    quote: "If you don't take risks, you can't create a future! I'm gonna be King of the Pirates!",
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png',
  },
  {
    id: 'zoro',
    name: 'Roronoa Zoro',
    nativeName: 'ロロノア・ゾロ',
    series: 'One Piece',
    role: 'Straw Hat Combatant & Master Swordsman',
    epithet: 'King of Hell · Pirate Hunter',
    voiceActor: 'Kazuya Nakai (中井 和哉)',
    bountyOrPower: '1,111,000,000 Berries',
    quote: 'Scars on the back are a swordsman’s shame. Nothing happened.',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png',
  },
  {
    id: 'gojo',
    name: 'Satoru Gojo',
    nativeName: '五条 悟',
    series: 'Jujutsu Kaisen (MAPPA / Gege Akutami)',
    role: 'Special Grade Jujutsu Sorcerer · Instructor',
    epithet: 'The Strongest Sorcerer Alive',
    voiceActor: 'Yuichi Nakamura (中村 悠一)',
    bountyOrPower: 'Limitless & Six Eyes (Inviolability)',
    quote: 'Throughout heaven and earth, I alone am the honored one. Don’t worry, I’m the strongest.',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png',
  },
  {
    id: 'tanjiro',
    name: 'Tanjiro Kamado',
    nativeName: '竈門 炭治郎',
    series: 'Demon Slayer: Kimetsu no Yaiba (ufotable)',
    role: 'Demon Slayer Corps Kanoe Rank',
    epithet: 'Sun Breathing Successor · Hinokami Kagura',
    voiceActor: 'Natsuki Hanae (花江 夏樹)',
    bountyOrPower: 'Sun Breathing & Black Nichirin Blade',
    quote: 'No matter how many people you may lose, you have no choice but to go on living.',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b126071-BTNEc1nRIv68.png',
  },
  {
    id: 'nezuko',
    name: 'Nezuko Kamado',
    nativeName: '竈門 禰豆子',
    series: 'Demon Slayer: Kimetsu no Yaiba',
    role: 'The Chosen Demon Sister',
    epithet: 'Sun-Conquering Demon Queen',
    voiceActor: 'Akari Kito (鬼頭 明里)',
    bountyOrPower: 'Blood Demon Art: Exploding Blood',
    quote: 'Humans are to be protected and saved... I will never hurt them!',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127518-NRlq1CQ1v1ro.png',
  },
  {
    id: 'naruto',
    name: 'Naruto Uzumaki',
    nativeName: 'うずまき ナルト',
    series: 'Naruto Shippuden (Studio Pierrot)',
    role: 'Seventh Hokage of Hidden Leaf',
    epithet: 'Child of Prophecy · Hero of the Hidden Leaf',
    voiceActor: 'Junko Takeuchi (竹内 順子)',
    bountyOrPower: 'Six Paths Sage Mode & Kurama Chakra',
    quote: 'I never go back on my word... that is my nindo: my ninja way!',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b17-phjcWCkRuIhu.png',
  },
  {
    id: 'sasuke',
    name: 'Sasuke Uchiha',
    nativeName: 'うちは サスケ',
    series: 'Naruto Shippuden',
    role: 'Shadow Hokage & Clan Head',
    epithet: 'The Supporting Shadow · Rinnegan Master',
    voiceActor: 'Noriaki Sugiyama (杉山 紀彰)',
    bountyOrPower: 'Eternal Mangekyo Sharingan & Rinnegan',
    quote: 'I have long since closed my eyes... My only goal is in the darkness.',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b13-SISLEw1oAD7a.png',
  },
  {
    id: 'levi',
    name: 'Levi Ackerman',
    nativeName: 'リヴァイ・アッカーマン',
    series: 'Attack on Titan (Wit Studio / MAPPA)',
    role: 'Survey Corps Special Operations Captain',
    epithet: "Humanity's Strongest Soldier",
    voiceActor: 'Hiroshi Kamiya (神谷 浩史)',
    bountyOrPower: 'Ackerman Awakening Combat Prowess',
    quote: 'The only thing we’re allowed to do is believe that we won’t regret the choice we made.',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png',
  },
  {
    id: 'eren',
    name: 'Eren Yeager',
    nativeName: 'エレン・イェーガー',
    series: 'Attack on Titan',
    role: 'Yeagerist Commander · Infiltrator',
    epithet: 'Attack & Founding Titan · The Harbinger',
    voiceActor: 'Yuki Kaji (梶 裕貴)',
    bountyOrPower: 'The Rumbling · Coordinate Control',
    quote: 'If you win, you live. If you lose, you die. If you don’t fight, you can’t win!',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40882-dsj7IP943WFF.jpg',
  },
  {
    id: 'makima',
    name: 'Makima',
    nativeName: 'マキマ',
    series: 'Chainsaw Man (MAPPA)',
    role: 'Public Safety Special Division 4 Leader',
    epithet: 'The Control Devil',
    voiceActor: 'Tomori Kusunoki (楠木 ともり)',
    bountyOrPower: 'Absolute Mind & Contract Subjugation',
    quote: 'A corpse is talking. Necessary evils are always excused by the state.',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b137080-UHcynYNjb5ZU.png',
  },
  {
    id: 'denji',
    name: 'Denji',
    nativeName: 'デンジ',
    series: 'Chainsaw Man',
    role: 'Public Safety Devil Hunter',
    epithet: 'The Chainsaw Man · Hero of Hell',
    voiceActor: 'Kikunosuke Toya (戸谷 菊之介)',
    bountyOrPower: 'Chainsaw Devil Heart (Pochita)',
    quote: 'Everyone is after my chainsaw heart! What about Denji’s heart?!',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b130102-FO1VHNnEnLlB.png',
  },
  {
    id: 'goku',
    name: 'Son Goku',
    nativeName: '孫 悟空',
    series: 'Dragon Ball Super (Toei Animation)',
    role: 'Universe 7 Champion & Martial Artist',
    epithet: 'Saiyan from Earth · God of Ultra Instinct',
    voiceActor: 'Masako Nozawa (野沢 雅子)',
    bountyOrPower: 'Mastered Ultra Instinct (Migatte no Gokui)',
    quote: 'I am the answer to all living things that cry out for peace! I am Son Goku!',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/246-wsRRr6z1kii8.png',
  },
  {
    id: 'vegeta',
    name: 'Vegeta',
    nativeName: 'ベジータ',
    series: 'Dragon Ball Super',
    role: 'Prince of all Saiyans',
    epithet: 'Warrior of Pride · God of Destruction Candidate',
    voiceActor: 'Ryo Horikawa (堀川 りょう)',
    bountyOrPower: 'Ultra Ego (Wagawamama no Gokui)',
    quote: 'There is only one certainty in life: A strong man stands above and conquers all!',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b913-NIFkKazWM8VO.png',
  },
  {
    id: 'itachi',
    name: 'Itachi Uchiha',
    nativeName: 'うちは イタチ',
    series: 'Naruto Shippuden',
    role: 'Akatsuki Infiltrator · Leaf Shinobi',
    epithet: 'Shadow Hokage · Genjutsu God',
    voiceActor: 'Hideo Ishikawa (石川 英郎)',
    bountyOrPower: 'Tsukuyomi, Amaterasu & Totsuka Blade',
    quote: 'People’s lives don’t end when they die. It ends when they lose faith.',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b14-9Kb1E5oel1ke.png',
  },
  {
    id: 'killua',
    name: 'Killua Zoldyck',
    nativeName: 'キルア＝ゾルディック',
    series: 'Hunter x Hunter (Madhouse)',
    role: 'Licensed Pro Hunter & Assassin Heir',
    epithet: 'Lightning Godspeed · Prodigy of the Zoldyck',
    voiceActor: 'Mariya Ise (伊瀬 茉莉也)',
    bountyOrPower: 'Transmutation Nen: Godspeed (Kanmuru)',
    quote: 'If you ignore a friend you have the ability to help, wouldn’t you be betraying him?',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b27-Z5O02kQUydpT.jpg',
  },
  {
    id: 'sukuna',
    name: 'Ryomen Sukuna',
    nativeName: '両面 宿儺',
    series: 'Jujutsu Kaisen',
    role: 'Cursed Spirit Incarnation',
    epithet: 'The King of Curses · Disgraced One',
    voiceActor: 'Junichi Suwabe (諏訪部 順一)',
    bountyOrPower: 'Malevolent Shrine · Cleave, Dismantle & World Cutting Slash',
    quote: 'Know your place, fool. Stand proud. You are strong.',
    url: 'https://s4.anilist.co/file/anilistcdn/character/large/b133701-rCQuDpHr3UZL.png',
  },
];

export const ANIME_AVATARS = ANIME_CHARACTERS.map(c => ({
  id: c.id,
  name: c.name,
  url: c.url,
  anime: c.series.split(' (')[0],
}));

export function calculateLevelFromXp(xp: number): { level: number; currentTier: string; nextLevelXp: number } {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  const level = Math.max(1, Math.floor(Math.sqrt(safeXp / 15)) + 1);
  const nextLevelXp = Math.round(15 * Math.pow(level, 2));

  let currentTier = 'Novice Anime Scout';
  if (level >= 50) currentTier = 'Yonko / Pirate King';
  else if (level >= 40) currentTier = 'Straw Hat Fleet Commander';
  else if (level >= 30) currentTier = 'Special Grade Sorcerer';
  else if (level >= 20) currentTier = 'Hashira Swordsman';
  else if (level >= 10) currentTier = 'Chunin Binge-Watcher';

  return { level, currentTier, nextLevelXp };
}

function createZeroStats(): UserStats {
  const { level, nextLevelXp } = calculateLevelFromXp(0);
  return {
    watchHours: 0,
    episodesWatched: 0,
    mangaChaptersRead: 0,
    completedAnime: 0,
    currentStreakDays: 1,
    level,
    currentXp: 0,
    nextLevelXp,
    favoriteGenres: [],
  };
}

function deriveBadgesFromStats(stats: UserStats, isVerified: boolean): UserBadge[] {
  const badges: UserBadge[] = [];
  if (isVerified) {
    badges.push({
      id: 'verified-account',
      title: 'Google Synced',
      description: 'Authenticated with verified Google OAuth & Firestore cloud sync.',
      icon: '🛡️',
      rarity: 'rare',
      unlockedAt: 'Verified',
    });
  }
  if (stats.episodesWatched >= 10) {
    badges.push({
      id: 'binge-initiate',
      title: 'Series Regular',
      description: 'Completed 10+ verified anime episodes.',
      icon: '📺',
      rarity: 'common',
      unlockedAt: 'Unlocked',
    });
  }
  if (stats.mangaChaptersRead >= 10) {
    badges.push({
      id: 'manga-reader',
      title: 'Manga Reader',
      description: 'Read 10+ manga chapters in the KuroStream Reader.',
      icon: '📖',
      rarity: 'epic',
      unlockedAt: 'Unlocked',
    });
  }
  if (stats.level >= 10) {
    badges.push({
      id: 'chunin-rank',
      title: 'Chunin Ascendant',
      description: 'Reached Level 10 through real streaming and reading activity.',
      icon: '⚡',
      rarity: 'legendary',
      unlockedAt: 'Unlocked',
    });
  }
  return badges;
}

function createDefaultGuestProfile(): UserProfile {
  const char = ANIME_CHARACTERS[3];
  return {
    id: 'local-guest',
    name: 'Guest Watcher',
    email: 'Local Session (Not Signed In)',
    avatar: char.url,
    bio: 'Local guest profile. Sign in with Google to verify your identity and sync across devices.',
    favoriteAnime: '',
    isGoogleVerified: false,
    isCloudSynced: false,
    joinedDate: 'Local Session',
    preferredAudio: 'sub',
    preferredServer: 'anixo',
    stats: createZeroStats(),
    badges: [],
    activeCharacter: char,
    createdAt: Date.now(),
  };
}

interface XpToast {
  id: string;
  amount: number;
  reason: string;
}

interface ActivityStatDelta {
  episodesWatched?: number;
  mangaChaptersRead?: number;
  completedAnime?: number;
  watchMinutes?: number;
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  authReady: boolean;
  authScopeKey: string;
  profiles: UserProfile[];
  currentProfileIndex: number;
  isAuthModalOpen: boolean;
  authError: string | null;
  dailyQuests: DailyQuest[];
  activeXpToasts: XpToast[];
  openAuthModal: () => void;
  closeAuthModal: () => void;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  switchProfile: (index: number) => void;
  addNewProfile: (name: string, avatarUrl: string, favoriteAnime?: string) => void;
  deleteLocalProfile: (profileId: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setCharacterAvatar: (characterId: string) => void;
  addXp: (amount: number, reason: string, dedupeKey?: string, statDelta?: ActivityStatDelta) => boolean;
  claimQuest: (questId: string) => Promise<void>;
  incrementQuestProgress: (category: 'watch' | 'manga' | 'party' | 'social', amount?: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const LOCAL_PROFILES_KEY = 'kurostream_local_profiles_v4';
const ACTIVE_PROFILE_KEY = 'kurostream_active_profile_id_v4';

function buildQuestStorageKey(scopeKey: string, dateKey: string): string {
  return `kurostream_quests_v2_${scopeKey}_${dateKey}`;
}

function buildClaimedActivitiesKey(scopeKey: string, dateKey: string): string {
  return `kurostream_claimed_xp_v1_${scopeKey}_${dateKey}`;
}

function questsFromCounts(counts: {
  dateKey: string;
  watchCount: number;
  mangaCount: number;
  partyCount: number;
  socialCount: number;
  claimedIds: string[];
}): DailyQuest[] {
  const fresh = createFreshDailyQuests(counts.dateKey);
  return fresh.map((q) => {
    let current = 0;
    if (q.category === 'watch') current = counts.watchCount;
    else if (q.category === 'manga') current = counts.mangaCount;
    else if (q.category === 'party') current = counts.partyCount;
    else if (q.category === 'social') current = counts.socialCount;
    return {
      ...q,
      current: Math.min(q.target, Math.max(0, current)),
      claimed: counts.claimedIds.includes(q.id),
      dateKey: counts.dateKey,
    };
  });
}

function sanitizeLocalProfile(raw: any): UserProfile | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  // Local profiles can NEVER forge Google verification or cloud sync
  const char =
    ANIME_CHARACTERS.find((c) => c.url === raw.avatar) || ANIME_CHARACTERS[0];
  const rawStats = raw.stats || {};
  const safeXp = Math.max(0, Math.min(10_000_000, Math.floor(Number(rawStats.currentXp) || 0)));
  const { level, nextLevelXp } = calculateLevelFromXp(safeXp);
  const stats: UserStats = {
    watchHours: Math.max(0, Number(rawStats.watchHours) || 0),
    episodesWatched: Math.max(0, Math.floor(Number(rawStats.episodesWatched) || 0)),
    mangaChaptersRead: Math.max(0, Math.floor(Number(rawStats.mangaChaptersRead) || 0)),
    completedAnime: Math.max(0, Math.floor(Number(rawStats.completedAnime) || 0)),
    currentStreakDays: Math.max(1, Math.floor(Number(rawStats.currentStreakDays) || 1)),
    level,
    currentXp: safeXp,
    nextLevelXp,
    favoriteGenres: Array.isArray(rawStats.favoriteGenres) ? rawStats.favoriteGenres.slice(0, 8) : [],
  };

  return {
    id: raw.id,
    name: String(raw.name || 'Local Watcher').slice(0, 64),
    email: 'Local Profile (Offline Only)',
    avatar: String(raw.avatar || char.url).slice(0, 512),
    bio: typeof raw.bio === 'string' ? raw.bio.slice(0, 280) : 'Local KuroStream profile',
    favoriteAnime: typeof raw.favoriteAnime === 'string' ? raw.favoriteAnime.slice(0, 120) : '',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    isGoogleVerified: false,
    isCloudSynced: false,
    joinedDate: raw.joinedDate || 'Local Session',
    preferredAudio: raw.preferredAudio === 'dub' ? 'dub' : 'sub',
    preferredServer: (['anixo', 'animeembed', 'megaplay-mal', 'zokoanime'].includes(raw.preferredServer)
      ? raw.preferredServer
      : 'anixo') as PreferredServerType,
    stats,
    badges: deriveBadgesFromStats(stats, false),
    activeCharacter: char,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [localProfiles, setLocalProfiles] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PROFILES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.map(sanitizeLocalProfile).filter(Boolean) as UserProfile[];
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch {
      // ignore corrupted storage
    }
    return [createDefaultGuestProfile()];
  });

  const [activeLocalIndex, setActiveLocalIndex] = useState<number>(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_PROFILE_KEY);
      if (savedId) {
        const savedProfiles = localStorage.getItem(LOCAL_PROFILES_KEY);
        if (savedProfiles) {
          const parsed = JSON.parse(savedProfiles);
          if (Array.isArray(parsed)) {
            const idx = parsed.findIndex((p: any) => p?.id === savedId);
            if (idx >= 0) return idx;
          }
        }
      }
    } catch {
      // ignore
    }
    return 0;
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [cloudProfile, setCloudProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeXpToasts, setActiveXpToasts] = useState<XpToast[]>([]);
  const [currentDateKey, setCurrentDateKey] = useState<string>(() => getUtcDateKey());

  const activeUser: UserProfile =
    cloudProfile && firebaseUser
      ? cloudProfile
      : localProfiles[activeLocalIndex] || localProfiles[0];

  const authScopeKey =
    firebaseUser && firebaseUser.emailVerified
      ? `uid_${firebaseUser.uid}`
      : `local_${activeUser.id}`;

  const [dailyQuests, setDailyQuests] = useState<DailyQuest[]>(() =>
    createFreshDailyQuests(currentDateKey)
  );
  const dailyQuestsRef = useRef<DailyQuest[]>(dailyQuests);
  dailyQuestsRef.current = dailyQuests;
  const localProfilesRef = useRef<UserProfile[]>(localProfiles);
  localProfilesRef.current = localProfiles;
  const dailyQuestDocReadyRef = useRef<string | null>(null);

  // Deduplication set for claimed XP keys within current UTC date
  const claimedActivityKeysRef = useRef<Set<string>>(new Set());

  // Validate Firestore connectivity once on boot
  useEffect(() => {
    validateFirestoreConnection().catch(() => {});
  }, []);

  // Keep UTC dateKey updated on focus or periodic check so quests reset at UTC midnight cleanly
  useEffect(() => {
    const checkRollover = () => {
      const latest = getUtcDateKey();
      setCurrentDateKey((prev) => (prev !== latest ? latest : prev));
    };
    const timer = setInterval(checkRollover, 60_000);
    window.addEventListener('focus', checkRollover);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', checkRollover);
    };
  }, []);

  // Load claimed XP keys for active scope + UTC date
  useEffect(() => {
    try {
      const raw = localStorage.getItem(buildClaimedActivitiesKey(authScopeKey, currentDateKey));
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          claimedActivityKeysRef.current = new Set(arr.filter((x) => typeof x === 'string'));
          return;
        }
      }
    } catch {
      // ignore
    }
    claimedActivityKeysRef.current = new Set();
  }, [authScopeKey, currentDateKey]);

  // Persist local profiles whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(localProfiles));
      const selected = localProfiles[activeLocalIndex];
      if (selected) {
        localStorage.setItem(ACTIVE_PROFILE_KEY, selected.id);
      }
    } catch (e) {
      console.warn('Failed to persist local profiles:', e);
    }
  }, [localProfiles, activeLocalIndex]);

  // Firebase Auth listener + Firestore Profile Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (!fbUser) {
        setCloudProfile(null);
        setAuthReady(true);
        return;
      }

      if (!fbUser.emailVerified) {
        setCloudProfile(null);
        setAuthError('Google account email must be verified before cloud sync is enabled.');
        setAuthReady(true);
        return;
      }

      const profilePath = `users/${fbUser.uid}/private/profile`;
      try {
        const profileRef = doc(db, 'users', fbUser.uid, 'private', 'profile');
        const snap = await getDoc(profileRef);

        if (snap.exists()) {
          const data = snap.data();
          const xp = Math.max(0, Number(data.xp) || 0);
          const { level, nextLevelXp } = calculateLevelFromXp(xp);
          const char =
            ANIME_CHARACTERS.find((c) => c.id === data.activeCharacterId) ||
            ANIME_CHARACTERS.find((c) => c.url === data.avatar) ||
            ANIME_CHARACTERS[0];
          const stats: UserStats = {
            watchHours: Number(((Number(data.watchMinutes) || 0) / 60).toFixed(1)),
            episodesWatched: Number(data.episodesWatched) || 0,
            mangaChaptersRead: Number(data.mangaChaptersRead) || 0,
            completedAnime: Number(data.completedAnime) || 0,
            currentStreakDays: 1,
            level,
            currentXp: xp,
            nextLevelXp,
            favoriteGenres: [],
          };

          setCloudProfile({
            id: fbUser.uid,
            name: String(data.name || fbUser.displayName || 'Otaku Watcher').slice(0, 64),
            email: String(data.email || fbUser.email || ''),
            avatar: String(data.avatar || fbUser.photoURL || char.url),
            bio: typeof data.bio === 'string' ? data.bio : '',
            favoriteAnime: typeof data.favoriteAnime === 'string' ? data.favoriteAnime : '',
            createdAt: data.createdAt?.toMillis?.() || Date.now(),
            isGoogleVerified: true,
            isCloudSynced: true,
            googleId: fbUser.uid,
            joinedDate: 'Google Synced',
            preferredAudio: data.preferredAudio === 'dub' ? 'dub' : 'sub',
            preferredServer: (['anixo', 'animeembed', 'megaplay-mal', 'zokoanime'].includes(data.preferredServer)
              ? data.preferredServer
              : 'anixo') as PreferredServerType,
            stats,
            badges: deriveBadgesFromStats(stats, true),
            activeCharacter: char,
          });
        } else {
          // Initialize brand-new verified Firestore profile with strict zeroed stats
          const defaultChar = ANIME_CHARACTERS[0];
          const safeName = (fbUser.displayName || 'Anime Watcher').slice(0, 64);
          const safeEmail = (fbUser.email || '').slice(0, 160);
          const safeAvatar = (fbUser.photoURL || defaultChar.url).slice(0, 512);

          await setDoc(profileRef, {
            uid: fbUser.uid,
            name: safeName,
            email: safeEmail,
            emailVerified: true,
            avatar: safeAvatar,
            bio: '',
            favoriteAnime: '',
            preferredAudio: 'sub',
            preferredServer: 'anixo',
            activeCharacterId: defaultChar.id,
            xp: 0,
            episodesWatched: 0,
            mangaChaptersRead: 0,
            completedAnime: 0,
            watchMinutes: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const zeroStats = createZeroStats();
          setCloudProfile({
            id: fbUser.uid,
            name: safeName,
            email: safeEmail,
            avatar: safeAvatar,
            bio: '',
            favoriteAnime: '',
            createdAt: Date.now(),
            isGoogleVerified: true,
            isCloudSynced: true,
            googleId: fbUser.uid,
            joinedDate: 'Google Synced',
            preferredAudio: 'sub',
            preferredServer: 'anixo',
            stats: zeroStats,
            badges: deriveBadgesFromStats(zeroStats, true),
            activeCharacter: defaultChar,
          });
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.GET, profilePath);
        } catch (wrapped: any) {
          setAuthError('Unable to sync cloud profile. Check connection or Firestore permissions.');
          console.error(wrapped);
        }
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load or reset daily quests when scope or UTC dateKey changes
  useEffect(() => {
    let cancelled = false;

    async function loadDailyQuests() {
      // Load local scope quests for currentDateKey first
      try {
        const raw = localStorage.getItem(buildQuestStorageKey(authScopeKey, currentDateKey));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.every((q: any) => q.dateKey === currentDateKey)) {
            if (!cancelled) setDailyQuests(parsed);
          }
        } else if (!cancelled) {
          setDailyQuests(createFreshDailyQuests(currentDateKey));
        }
      } catch {
        if (!cancelled) setDailyQuests(createFreshDailyQuests(currentDateKey));
      }

      if (!firebaseUser || !firebaseUser.emailVerified) return;

      const questPath = `users/${firebaseUser.uid}/dailyQuests/${currentDateKey}`;
      try {
        const questRef = doc(db, 'users', firebaseUser.uid, 'dailyQuests', currentDateKey);
        const snap = await getDoc(questRef);
        if (cancelled) return;

        if (snap.exists()) {
          const data = snap.data();
          const hydrated = questsFromCounts({
            dateKey: currentDateKey,
            watchCount: Number(data.watchCount) || 0,
            mangaCount: Number(data.mangaCount) || 0,
            partyCount: Number(data.partyCount) || 0,
            socialCount: Number(data.socialCount) || 0,
            claimedIds: Array.isArray(data.claimedIds) ? data.claimedIds : [],
          });
          dailyQuestDocReadyRef.current = `${firebaseUser.uid}:${currentDateKey}`;
          dailyQuestsRef.current = hydrated;
          setDailyQuests(hydrated);
          try {
            localStorage.setItem(buildQuestStorageKey(authScopeKey, currentDateKey), JSON.stringify(hydrated));
          } catch {}
        } else {
          await setDoc(questRef, {
            uid: firebaseUser.uid,
            dateKey: currentDateKey,
            watchCount: 0,
            mangaCount: 0,
            partyCount: 0,
            socialCount: 0,
            claimedIds: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          dailyQuestDocReadyRef.current = `${firebaseUser.uid}:${currentDateKey}`;
          const fresh = createFreshDailyQuests(currentDateKey);
          dailyQuestsRef.current = fresh;
          setDailyQuests(fresh);
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.GET, questPath);
        } catch (wrapped) {
          console.error(wrapped);
        }
      }
    }

    loadDailyQuests();
    return () => {
      cancelled = true;
    };
  }, [authScopeKey, currentDateKey, firebaseUser]);

  const persistDailyQuests = useCallback(
    async (nextQuests: DailyQuest[]) => {
      try {
        localStorage.setItem(buildQuestStorageKey(authScopeKey, currentDateKey), JSON.stringify(nextQuests));
      } catch {}

      if (firebaseUser && firebaseUser.emailVerified) {
        const questPath = `users/${firebaseUser.uid}/dailyQuests/${currentDateKey}`;
        const questRef = doc(db, 'users', firebaseUser.uid, 'dailyQuests', currentDateKey);
        const watchQ = nextQuests.find((q) => q.category === 'watch');
        const mangaQ = nextQuests.find((q) => q.category === 'manga');
        const partyQ = nextQuests.find((q) => q.category === 'party');
        const socialQ = nextQuests.find((q) => q.category === 'social');
        const claimedIds = nextQuests.filter((q) => q.claimed).map((q) => q.id).slice(0, 10);

        const countsPayload = {
          watchCount: Math.min(100, watchQ?.current || 0),
          mangaCount: Math.min(100, mangaQ?.current || 0),
          partyCount: Math.min(100, partyQ?.current || 0),
          socialCount: Math.min(100, socialQ?.current || 0),
          claimedIds,
          updatedAt: serverTimestamp(),
        };

        const createQuestDoc = async () => {
          await setDoc(questRef, {
            uid: firebaseUser.uid,
            dateKey: currentDateKey,
            ...countsPayload,
            createdAt: serverTimestamp(),
          });
          dailyQuestDocReadyRef.current = `${firebaseUser.uid}:${currentDateKey}`;
        };

        try {
          if (dailyQuestDocReadyRef.current !== `${firebaseUser.uid}:${currentDateKey}`) {
            await createQuestDoc();
          } else {
            await updateDoc(questRef, countsPayload);
          }
        } catch (err: any) {
          if (err?.code === 'not-found') {
            try {
              await createQuestDoc();
              return;
            } catch {}
          }
          try {
            handleFirestoreError(err, OperationType.UPDATE, questPath);
          } catch (wrapped) {
            console.error(wrapped);
          }
        }
      }
    },
    [authScopeKey, currentDateKey, firebaseUser]
  );

  const showXpToast = useCallback((amount: number, reason: string) => {
    const toastId = `xp-${Date.now()}-${Math.random()}`;
    setActiveXpToasts((prev) => [...prev, { id: toastId, amount, reason }]);
    setTimeout(() => {
      setActiveXpToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 3500);
  }, []);

  const addXp = useCallback(
    (
      amount: number,
      reason: string,
      dedupeKey?: string,
      statDelta: ActivityStatDelta = {}
    ): boolean => {
      const safeAmount = Math.max(1, Math.min(200, Math.floor(amount)));
      if (dedupeKey) {
        if (claimedActivityKeysRef.current.has(dedupeKey)) {
          return false;
        }
        claimedActivityKeysRef.current.add(dedupeKey);
        try {
          localStorage.setItem(
            buildClaimedActivitiesKey(authScopeKey, currentDateKey),
            JSON.stringify(Array.from(claimedActivityKeysRef.current).slice(-200))
          );
        } catch {}
      }

      showXpToast(safeAmount, reason);

      if (firebaseUser && firebaseUser.emailVerified && cloudProfile) {
        const oldStats = cloudProfile.stats || createZeroStats();
        const newXp = oldStats.currentXp + safeAmount;
        const { level, nextLevelXp } = calculateLevelFromXp(newXp);
        const epDelta = Math.max(0, Math.min(1, Math.floor(statDelta.episodesWatched || 0)));
        const mangaDelta = Math.max(0, Math.min(1, Math.floor(statDelta.mangaChaptersRead || 0)));
        const completedDelta = Math.max(0, Math.min(1, Math.floor(statDelta.completedAnime || 0)));
        const minDelta = Math.max(0, Math.min(120, Math.floor(statDelta.watchMinutes || 0)));

        const updatedStats: UserStats = {
          ...oldStats,
          currentXp: newXp,
          level,
          nextLevelXp,
          episodesWatched: oldStats.episodesWatched + epDelta,
          mangaChaptersRead: oldStats.mangaChaptersRead + mangaDelta,
          completedAnime: oldStats.completedAnime + completedDelta,
          watchHours: Number((oldStats.watchHours + minDelta / 60).toFixed(1)),
        };

        setCloudProfile((prev) =>
          prev
            ? {
                ...prev,
                stats: updatedStats,
                badges: deriveBadgesFromStats(updatedStats, true),
              }
            : null
        );

        const totalMinutes = Math.round(updatedStats.watchHours * 60);
        const profilePath = `users/${firebaseUser.uid}/private/profile`;
        updateDoc(doc(db, 'users', firebaseUser.uid, 'private', 'profile'), {
          xp: newXp,
          episodesWatched: updatedStats.episodesWatched,
          mangaChaptersRead: updatedStats.mangaChaptersRead,
          completedAnime: updatedStats.completedAnime,
          watchMinutes: totalMinutes,
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          try {
            handleFirestoreError(err, OperationType.UPDATE, profilePath);
          } catch (wrapped) {
            console.error(wrapped);
          }
        });

        return true;
      }

      // Local profile XP update
      setLocalProfiles((prev) =>
        prev.map((p, idx) => {
          if (idx !== activeLocalIndex) return p;
          const oldStats = p.stats || createZeroStats();
          const newXp = oldStats.currentXp + safeAmount;
          const { level, nextLevelXp } = calculateLevelFromXp(newXp);
          const nextStats: UserStats = {
            ...oldStats,
            currentXp: newXp,
            level,
            nextLevelXp,
            episodesWatched: oldStats.episodesWatched + (statDelta.episodesWatched || 0),
            mangaChaptersRead: oldStats.mangaChaptersRead + (statDelta.mangaChaptersRead || 0),
            completedAnime: oldStats.completedAnime + (statDelta.completedAnime || 0),
            watchHours: Number(
              (oldStats.watchHours + (statDelta.watchMinutes || 0) / 60).toFixed(1)
            ),
          };
          return {
            ...p,
            stats: nextStats,
            badges: deriveBadgesFromStats(nextStats, false),
          };
        })
      );

      return true;
    },
    [activeLocalIndex, authScopeKey, cloudProfile, currentDateKey, firebaseUser, showXpToast]
  );

  const incrementQuestProgress = useCallback(
    (category: 'watch' | 'manga' | 'party' | 'social', amount: number = 1) => {
      const prev = dailyQuestsRef.current;
      let changed = false;
      const next = prev.map((q) => {
        if (q.dateKey !== currentDateKey) return q;
        if (q.category === category && !q.claimed && q.current < q.target) {
          changed = true;
          return { ...q, current: Math.min(q.target, q.current + amount) };
        }
        return q;
      });
      if (changed) {
        dailyQuestsRef.current = next;
        setDailyQuests(next);
        persistDailyQuests(next);
      }
    },
    [currentDateKey, persistDailyQuests]
  );

  const claimQuest = useCallback(
    async (questId: string) => {
      const quest = dailyQuestsRef.current.find((q) => q.id === questId);
      if (!quest || quest.claimed || quest.current < quest.target) return;

      const dedupeKey = `quest:${questId}:${currentDateKey}`;
      const granted = addXp(quest.xpReward, `Completed: ${quest.title}`, dedupeKey);
      if (!granted) return;

      const nextQuests = dailyQuestsRef.current.map((q) =>
        q.id === questId ? { ...q, claimed: true } : q
      );
      dailyQuestsRef.current = nextQuests;
      setDailyQuests(nextQuests);
      await persistDailyQuests(nextQuests);
    },
    [addXp, currentDateKey, persistDailyQuests]
  );

  const signInWithGoogle = async (): Promise<{ ok: boolean; error?: string }> => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (!cred.user.emailVerified) {
        const msg = 'Your Google account email is not verified.';
        setAuthError(msg);
        return { ok: false, error: msg };
      }
      setIsAuthModalOpen(false);
      return { ok: true };
    } catch (err: any) {
      const code = err?.code || '';
      let msg = err?.message || 'Google sign-in was cancelled or blocked.';
      if (code === 'auth/popup-closed-by-user') {
        msg = 'Google sign-in popup was closed before completing authentication.';
      } else if (code === 'auth/popup-blocked') {
        msg = 'Browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
      }
      setAuthError(msg);
      return { ok: false, error: msg };
    }
  };

  const signOut = async () => {
    setAuthError(null);
    if (firebaseUser) {
      try {
        await firebaseSignOut(auth);
      } catch (err) {
        console.error('Firebase signOut error:', err);
      }
      setCloudProfile(null);
    }
    // Switch cleanly to Guest without wiping user's other local profiles
    const guestIdx = localProfiles.findIndex((p) => p.id === 'local-guest');
    if (guestIdx >= 0) {
      setActiveLocalIndex(guestIdx);
    } else {
      const guest = createDefaultGuestProfile();
      setLocalProfiles((prev) => [guest, ...prev]);
      setActiveLocalIndex(0);
    }
  };

  const switchProfile = (index: number) => {
    if (firebaseUser) {
      // Must sign out of Google session to browse as a different local profile
      firebaseSignOut(auth).catch(() => {});
      setCloudProfile(null);
    }
    if (index >= 0 && index < localProfiles.length) {
      setActiveLocalIndex(index);
    }
  };

  const addNewProfile = (name: string, avatarUrl: string, favoriteAnime?: string) => {
    const cleanName = name.trim().slice(0, 64);
    if (!cleanName) return;

    const matchedChar = ANIME_CHARACTERS.find((c) => c.url === avatarUrl) || ANIME_CHARACTERS[0];
    const newProfile: UserProfile = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      email: 'Local Profile (Offline Only)',
      avatar: matchedChar.url,
      favoriteAnime: (favoriteAnime || '').trim().slice(0, 120),
      bio: `Local KuroStream profile for ${cleanName}`,
      isGoogleVerified: false,
      isCloudSynced: false,
      joinedDate: 'Local Profile',
      preferredAudio: 'sub',
      preferredServer: 'anixo',
      stats: createZeroStats(),
      badges: [],
      activeCharacter: matchedChar,
      createdAt: Date.now(),
    };

    if (firebaseUser) {
      firebaseSignOut(auth).catch(() => {});
      setCloudProfile(null);
    }

    const next = [...localProfilesRef.current, newProfile];
    localProfilesRef.current = next;
    setLocalProfiles(next);
    setActiveLocalIndex(next.length - 1);
  };

  const deleteLocalProfile = (profileId: string) => {
    if (profileId === 'local-guest') return;
    const filtered = localProfilesRef.current.filter((p) => p.id !== profileId);
    const next = filtered.length > 0 ? filtered : [createDefaultGuestProfile()];
    localProfilesRef.current = next;
    setLocalProfiles(next);
    setActiveLocalIndex(0);
  };

  const updateProfile = useCallback(
    (updates: Partial<UserProfile>) => {
      // Strip privileged flags — verification only comes from Firebase Auth token
      const {
        isGoogleVerified: _ignored1,
        isCloudSynced: _ignored2,
        googleId: _ignored3,
        stats: _ignored4,
        ...safeUpdates
      } = updates;

      if (firebaseUser && firebaseUser.emailVerified && cloudProfile) {
        setCloudProfile((prev) => (prev ? { ...prev, ...safeUpdates } : null));

        const payload: Record<string, any> = { updatedAt: serverTimestamp() };
        if (typeof safeUpdates.name === 'string' && safeUpdates.name.trim()) {
          payload.name = safeUpdates.name.trim().slice(0, 64);
        }
        if (typeof safeUpdates.avatar === 'string' && safeUpdates.avatar.trim()) {
          payload.avatar = safeUpdates.avatar.trim().slice(0, 512);
        }
        if (typeof safeUpdates.bio === 'string') {
          payload.bio = safeUpdates.bio.slice(0, 280);
        }
        if (typeof safeUpdates.favoriteAnime === 'string') {
          payload.favoriteAnime = safeUpdates.favoriteAnime.slice(0, 120);
        }
        if (safeUpdates.preferredAudio) {
          payload.preferredAudio = safeUpdates.preferredAudio;
        }
        if (safeUpdates.preferredServer) {
          payload.preferredServer = safeUpdates.preferredServer;
        }
        if (safeUpdates.activeCharacter?.id) {
          payload.activeCharacterId = safeUpdates.activeCharacter.id.slice(0, 64);
        }

        const profilePath = `users/${firebaseUser.uid}/private/profile`;
        updateDoc(doc(db, 'users', firebaseUser.uid, 'private', 'profile'), payload).catch((err) => {
          try {
            handleFirestoreError(err, OperationType.UPDATE, profilePath);
          } catch (wrapped) {
            console.error(wrapped);
          }
        });
        return;
      }

      setLocalProfiles((prev) =>
        prev.map((p, idx) => (idx === activeLocalIndex ? { ...p, ...safeUpdates } : p))
      );
    },
    [activeLocalIndex, cloudProfile, firebaseUser]
  );

  const setCharacterAvatar = (characterId: string) => {
    const char = ANIME_CHARACTERS.find((c) => c.id === characterId);
    if (!char) return;
    updateProfile({
      avatar: char.url,
      activeCharacter: char,
    });
    addXp(15, `Equipped ${char.name} Persona`, `persona:${characterId}`);
  };

  return (
    <AuthContext.Provider
      value={{
        user: activeUser,
        firebaseUser,
        authReady,
        authScopeKey,
        profiles: localProfiles,
        currentProfileIndex: activeLocalIndex,
        isAuthModalOpen,
        authError,
        dailyQuests,
        activeXpToasts,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        clearAuthError: () => setAuthError(null),
        signInWithGoogle,
        signOut,
        switchProfile,
        addNewProfile,
        deleteLocalProfile,
        updateProfile,
        setCharacterAvatar,
        addXp,
        claimQuest,
        incrementQuestProgress,
      }}
    >
      {children}

      {/* Floating XP Gain Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {activeXpToasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#0f1322]/95 backdrop-blur-md border border-violet-500/50 shadow-2xl text-white text-xs animate-in slide-in-from-bottom-3 duration-300 pointer-events-auto"
          >
            <span className="p-1.5 rounded-xl bg-violet-600/30 text-amber-400 font-extrabold text-xs">
              +{toast.amount} XP
            </span>
            <span className="font-semibold text-slate-200">{toast.reason}</span>
          </div>
        ))}
      </div>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
