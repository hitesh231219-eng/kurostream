import React, { useState, useEffect } from 'react';
import { useAuth, ANIME_CHARACTERS } from '../context/AuthContext';
import {
  X,
  Check,
  Plus,
  User,
  LogOut,
  Sparkles,
  Flame,
  Award,
  Clock,
  Tv,
  BookOpen,
  ShieldCheck,
  Zap,
  Mic,
  Quote,
  Layers,
  ChevronRight,
  AlertCircle,
  Loader2,
  Trash2,
  Pencil,
} from 'lucide-react';
import { AnimeCharacterProfile } from '../types/anime';

export const AuthProfileModal: React.FC = () => {
  const {
    user,
    profiles,
    currentProfileIndex,
    isAuthModalOpen,
    authError,
    clearAuthError,
    closeAuthModal,
    signInWithGoogle,
    signOut,
    switchProfile,
    addNewProfile,
    deleteLocalProfile,
    updateProfile,
    setCharacterAvatar,
    dailyQuests,
    claimQuest,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'quests' | 'characters' | 'switch' | 'add'>('profile');
  const [newProfileName, setNewProfileName] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState(ANIME_CHARACTERS[0].id);
  const [favoriteAnime, setFavoriteAnime] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editFavoriteAnime, setEditFavoriteAnime] = useState('');
  const [brokenAvatars, setBrokenAvatars] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsEditingProfile(false);
  }, [user?.id, activeTab]);

  useEffect(() => {
    if (!isAuthModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAuthModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const activeChar: AnimeCharacterProfile =
    user?.activeCharacter ||
    ANIME_CHARACTERS.find((c) => c.url === user?.avatar) ||
    ANIME_CHARACTERS[0];

  const handleStartEditProfile = () => {
    if (!user) return;
    setEditName(user.name || '');
    setEditBio(user.bio || '');
    setEditFavoriteAnime(user.favoriteAnime || '');
    setIsEditingProfile(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = editName.trim();
    if (!trimmedName) return;
    updateProfile({
      name: trimmedName.slice(0, 64),
      bio: editBio.trim().slice(0, 280),
      favoriteAnime: editFavoriteAnime.trim().slice(0, 120),
    });
    setIsEditingProfile(false);
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    const char = ANIME_CHARACTERS.find((c) => c.id === selectedCharacterId) || ANIME_CHARACTERS[0];
    addNewProfile(newProfileName.trim(), char.url, favoriteAnime);
    setNewProfileName('');
    setFavoriteAnime('');
    setActiveTab('profile');
  };

  const handleGoogleConnect = async () => {
    clearAuthError();
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } finally {
      setGoogleBusy(false);
    }
  };

  const stats = user?.stats || {
    watchHours: 0,
    episodesWatched: 0,
    mangaChaptersRead: 0,
    completedAnime: 0,
    currentStreakDays: 1,
    level: 1,
    currentXp: 0,
    nextLevelXp: 15,
    favoriteGenres: [],
  };

  const xpPercent =
    stats.nextLevelXp > 0
      ? Math.min(100, Math.round((stats.currentXp / stats.nextLevelXp) * 100))
      : 0;

  const isVerifiedCloud = Boolean(user?.isGoogleVerified && user?.isCloudSynced);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="User Profile and Account"
      onClick={closeAuthModal}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0c0e14] border border-[#232738] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c2130] bg-[#10131d] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Account & Progression</h2>
                {isVerifiedCloud ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="w-3 h-3" />
                    Google Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-700/40 text-slate-300 border border-slate-600/40">
                    Local Session
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {isVerifiedCloud
                  ? 'Authenticated via Firebase Google OAuth · Cloud watchlist & quests synced'
                  : 'Sign in with Google for verified cloud backup across devices'}
              </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            aria-label="Close account modal"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#1a1f2e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auth Error Notice */}
        {authError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
            <button onClick={clearAuthError} className="text-rose-300 hover:text-white font-semibold">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-[#1a1f2e] px-6 pt-2 gap-4 sm:gap-6 text-xs font-semibold overflow-x-auto no-scrollbar shrink-0 bg-[#090b10]">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-violet-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-violet-400" />
            Profile & Stats
          </button>
          <button
            onClick={() => setActiveTab('quests')}
            className={`pb-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'quests'
                ? 'border-violet-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Daily Quests
            {dailyQuests.filter((q) => !q.claimed && q.current >= q.target).length > 0 && (
              <span className="text-[11px] font-mono tabular-nums text-amber-400">
                ({dailyQuests.filter((q) => !q.claimed && q.current >= q.target).length})
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('characters')}
            className={`pb-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'characters'
                ? 'border-violet-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Avatars ({ANIME_CHARACTERS.length})
          </button>
          <button
            onClick={() => setActiveTab('switch')}
            className={`pb-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'switch'
                ? 'border-violet-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Account & Profiles ({profiles.length})
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`pb-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'border-violet-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            New Local Profile
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: Profile Dashboard */}
          {activeTab === 'profile' && user && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {!isVerifiedCloud && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-950/50 via-[#151926] to-[#111524] border border-violet-500/35 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs space-y-0.5 text-center sm:text-left">
                    <p className="font-bold text-white">Sync Watchlist & Progress with Google</p>
                    <p className="text-slate-400">
                      Sign in via real Google OAuth to keep your watch history, quests, and XP backed up in Firestore.
                    </p>
                  </div>
                  <button
                    onClick={handleGoogleConnect}
                    disabled={googleBusy}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0"
                  >
                    {googleBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{googleBusy ? 'Signing In...' : 'Sign In with Google'}</span>
                  </button>
                </div>
              )}

              {/* Profile Card Header */}
              <div className="relative rounded-2xl bg-gradient-to-r from-violet-950/40 via-[#131726] to-[#0e111b] border border-[#232738] p-5 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
                  <div className="relative group shrink-0">
                    {brokenAvatars[`main:${user.avatar}`] ? (
                      <div className="w-20 h-20 rounded-2xl border-2 border-violet-500/50 shadow-xl bg-violet-950/60 flex items-center justify-center text-2xl font-extrabold text-violet-200">
                        {(user.name || 'K').charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenAvatars((prev) => ({ ...prev, [`main:${user.avatar}`]: true }))
                        }
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-violet-500/50 shadow-xl"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('characters')}
                      className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold"
                    >
                      Change
                    </button>
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0 w-full">
                    {isEditingProfile ? (
                      <form onSubmit={handleSaveProfile} className="space-y-2.5 text-left">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                              Display Name
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={64}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg bg-[#0d1018] border border-[#2a3147] text-xs text-white focus:outline-none focus:border-violet-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                              Favorite Anime
                            </label>
                            <input
                              type="text"
                              maxLength={120}
                              placeholder="e.g. Frieren, One Piece..."
                              value={editFavoriteAnime}
                              onChange={(e) => setEditFavoriteAnime(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg bg-[#0d1018] border border-[#2a3147] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                            Bio
                          </label>
                          <input
                            type="text"
                            maxLength={280}
                            placeholder="Tell others what you're watching..."
                            value={editBio}
                            onChange={(e) => setEditBio(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-[#0d1018] border border-[#2a3147] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsEditingProfile(false)}
                            className="px-3 py-1.5 rounded-lg bg-[#171b29] text-xs font-semibold text-slate-300 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save Changes</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <h3 className="text-lg font-bold text-white tracking-tight">{user.name}</h3>
                          <span className="px-2 py-0.5 rounded-full bg-violet-600/30 text-violet-300 text-[10px] font-mono font-bold border border-violet-500/30">
                            Level {stats.level}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {user.joinedDate || 'Member'}
                          </span>
                          <button
                            type="button"
                            onClick={handleStartEditProfile}
                            className="ml-auto px-2.5 py-1 rounded-lg bg-[#171c2b] hover:bg-[#1f263a] border border-[#29314a] text-[11px] font-semibold text-slate-300 hover:text-white inline-flex items-center gap-1 transition-colors"
                          >
                            <Pencil className="w-3 h-3 text-violet-400" />
                            <span>Edit</span>
                          </button>
                        </div>

                        <p className="text-xs text-slate-300 font-mono">{user.email}</p>

                        {user.bio && <p className="text-xs text-slate-400 italic">"{user.bio}"</p>}
                        {user.favoriteAnime && (
                          <p className="text-[11px] text-violet-300 font-medium">
                            Favorite Series: <span className="text-slate-200">{user.favoriteAnime}</span>
                          </p>
                        )}
                      </>
                    )}

                    {/* XP Progress Bar */}
                    <div className="pt-1.5 space-y-1 max-w-md">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>XP Progress</span>
                        <span>
                          {stats.currentXp.toLocaleString()} / {stats.nextLevelXp.toLocaleString()} XP ({xpPercent}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#1b2030] overflow-hidden border border-[#2b334d]">
                        <div
                          className="h-full bg-gradient-to-r from-violet-600 to-indigo-400 rounded-full transition-all duration-500"
                          style={{ width: `${xpPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#0f121d] border border-[#202538] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-semibold">Watch Time</span>
                    <Clock className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="mt-2">
                    <p className="text-xl font-extrabold text-white font-mono">{stats.watchHours} hrs</p>
                    <p className="text-[10px] text-slate-500">Verified Playback</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#0f121d] border border-[#202538] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-semibold">Episodes</span>
                    <Tv className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2">
                    <p className="text-xl font-extrabold text-white font-mono">{stats.episodesWatched}</p>
                    <p className="text-[10px] text-slate-500">Watched Episodes</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#0f121d] border border-[#202538] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-semibold">Manga Chapters</span>
                    <BookOpen className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="mt-2">
                    <p className="text-xl font-extrabold text-white font-mono">{stats.mangaChaptersRead}</p>
                    <p className="text-[10px] text-slate-500">Chapters Read</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#0f121d] border border-[#202538] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-semibold">Completed</span>
                    <Flame className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-2">
                    <p className="text-xl font-extrabold text-white font-mono">{stats.completedAnime}</p>
                    <p className="text-[10px] text-slate-500">Finished Titles</p>
                  </div>
                </div>
              </div>

              {/* Active Character Lore */}
              {activeChar && (
                <div className="p-4 sm:p-5 rounded-2xl bg-[#0f1320] border border-[#242b40] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Active Anime Persona
                      </h4>
                    </div>
                    <button
                      onClick={() => setActiveTab('characters')}
                      className="text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1"
                    >
                      <span>Change Avatar</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                    <div className="p-3 rounded-xl bg-[#141826] border border-[#23293e] space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Character</span>
                      <p className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{activeChar.name}</span>
                        <span className="text-xs font-normal text-violet-300 font-mono">({activeChar.nativeName})</span>
                      </p>
                      <p className="text-[11px] text-slate-300">{activeChar.series}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#141826] border border-[#23293e] space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Title & Epithet</span>
                      <p className="font-bold text-amber-300">{activeChar.epithet}</p>
                      <p className="text-[11px] text-slate-300">{activeChar.role}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#141826] border border-[#23293e] space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Mic className="w-3 h-3 text-violet-400" />
                        Voice Actor
                      </span>
                      <p className="font-semibold text-white">{activeChar.voiceActor}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#141826] border border-[#23293e] space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Quote className="w-3 h-3 text-violet-400" />
                        Quote
                      </span>
                      <p className="text-[11px] text-slate-200 italic leading-relaxed">"{activeChar.quote}"</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Unlocked Badges */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-violet-400" />
                  Unlocked Badges ({user.badges?.length || 0})
                </h4>

                {(user.badges || []).length === 0 ? (
                  <p className="text-xs text-slate-400 bg-[#111422] border border-[#1f253a] p-3.5 rounded-xl">
                    Watch episodes, read manga chapters, or connect Google OAuth to unlock progression badges.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(user.badges || []).map((badge) => (
                      <div
                        key={badge.id}
                        className="p-3 rounded-xl bg-[#111422] border border-[#1f253a] flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#171b2d] border border-[#29324d] flex items-center justify-center text-lg shrink-0">
                          {badge.icon}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{badge.title}</h5>
                          <p className="text-[11px] text-slate-400 truncate">{badge.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Daily Quests (UTC Date Scoped) */}
          {activeTab === 'quests' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Daily Quests
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Isolated per account and automatically reset every day at 00:00 UTC.
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                  {dailyQuests[0]?.dateKey || 'Today (UTC)'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {dailyQuests.map((q) => {
                  const isCompleted = q.current >= q.target;
                  const percent = Math.min(100, Math.round((q.current / q.target) * 100));

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        q.claimed
                          ? 'bg-[#0f121b]/60 border-[#1c2132] opacity-75'
                          : isCompleted
                          ? 'bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-500/10'
                          : 'bg-[#121624] border-[#22283a]'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{q.title}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-600/20 text-violet-300 border border-violet-500/30">
                            +{q.xpReward} XP
                          </span>
                        </h5>
                        <p className="text-xs text-slate-300">{q.description}</p>

                        <div className="flex items-center gap-3 pt-1 max-w-sm">
                          <div className="flex-1 h-2 rounded-full bg-[#1b2030] overflow-hidden border border-[#2b334d]">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCompleted ? 'bg-emerald-400' : 'bg-violet-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 shrink-0">
                            {q.current} / {q.target}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 w-full sm:w-auto">
                        {q.claimed ? (
                          <span className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Claimed</span>
                          </span>
                        ) : isCompleted ? (
                          <button
                            onClick={() => claimQuest(q.id)}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Claim +{q.xpReward} XP</span>
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl bg-[#171b29] text-slate-400 text-xs font-medium block text-center">
                            {percent}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Characters */}
          {activeTab === 'characters' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[58vh] overflow-y-auto p-1">
                {ANIME_CHARACTERS.map((c) => {
                  const isCurrent = user?.avatar === c.url || activeChar.id === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setCharacterAvatar(c.id)}
                      className={`group relative rounded-2xl overflow-hidden border cursor-pointer transition-all duration-200 flex flex-col text-left ${
                        isCurrent
                          ? 'border-violet-500 ring-2 ring-violet-500/50 bg-[#161a2b] shadow-xl'
                          : 'border-[#1f2436] bg-[#0f121d] hover:border-slate-500'
                      }`}
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-black">
                        {brokenAvatars[`char:${c.id}`] ? (
                          <div className="w-full h-full flex items-center justify-center bg-violet-950/60 text-lg font-extrabold text-violet-200">
                            {c.name.charAt(0)}
                          </div>
                        ) : (
                          <img
                            src={c.url}
                            alt={c.name}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenAvatars((prev) => ({ ...prev, [`char:${c.id}`]: true }))
                            }
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}
                        {isCurrent && (
                          <div className="absolute top-2 right-2 p-1 rounded-full bg-violet-600 text-white">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <h4 className="text-xs font-bold text-white truncate">{c.name}</h4>
                        <p className="text-[10px] text-slate-400 truncate">{c.series.split(' (')[0]}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Account & Profiles */}
          {activeTab === 'switch' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Real Google OAuth Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-900/30 via-[#151926] to-slate-900/40 border border-violet-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-2 shrink-0">
                    <svg className="w-full h-full" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      Google Account Authentication
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                        Firebase OAuth
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isVerifiedCloud
                        ? `Signed in as ${user?.email}`
                        : 'Cryptographic identity verification & cloud watchlist synchronization'}
                    </p>
                  </div>
                </div>

                {isVerifiedCloud ? (
                  <button
                    onClick={signOut}
                    className="px-4 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGoogleConnect}
                    disabled={googleBusy}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    {googleBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{googleBusy ? 'Connecting...' : 'Sign In with Google'}</span>
                  </button>
                )}
              </div>

              {/* Local Profiles List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Local Device Profiles (Isolated Watchlists)
                  </h3>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Local Profile
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profiles.map((p, idx) => {
                    const isSelected = !isVerifiedCloud && idx === currentProfileIndex;
                    return (
                      <div
                        key={p.id}
                        onClick={() => switchProfile(idx)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-violet-950/40 border-violet-500 shadow-md'
                            : 'bg-[#121624] border-[#202538] hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {brokenAvatars[`local:${p.id}:${p.avatar}`] ? (
                            <div className="w-11 h-11 rounded-xl border border-[#2c334b] shrink-0 bg-violet-950/60 flex items-center justify-center text-sm font-bold text-violet-200">
                              {(p.name || 'G').charAt(0).toUpperCase()}
                            </div>
                          ) : (
                            <img
                              src={p.avatar}
                              alt={p.name}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setBrokenAvatars((prev) => ({
                                  ...prev,
                                  [`local:${p.id}:${p.avatar}`]: true,
                                }))
                              }
                              className="w-11 h-11 rounded-xl object-cover border border-[#2c334b] shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">{p.name}</h4>
                            <p className="text-[10px] text-slate-400 truncate">
                              Local Only · Lv.{p.stats?.level ?? 1}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.id !== 'local-guest' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLocalProfile(p.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#1a1f2e]"
                              title="Delete local profile"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isSelected && (
                            <div className="p-1 rounded-full bg-violet-500 text-white">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Add New Local Profile */}
          {activeTab === 'add' && (
            <form onSubmit={handleCreateProfile} className="space-y-5 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Local Profile Display Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={64}
                  placeholder="Enter display name..."
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141824] border border-[#232738] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Favorite Anime Series (Optional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="e.g. One Piece, Frieren..."
                  value={favoriteAnime}
                  onChange={(e) => setFavoriteAnime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141824] border border-[#232738] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Select Avatar:
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 max-h-48 overflow-y-auto p-1">
                  {ANIME_CHARACTERS.map((c) => {
                    const isSelected = selectedCharacterId === c.id;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setSelectedCharacterId(c.id)}
                        className={`relative rounded-xl overflow-hidden border cursor-pointer aspect-square transition-all ${
                          isSelected
                            ? 'border-violet-500 ring-2 ring-violet-500/50 scale-105'
                            : 'border-[#22283a] hover:border-slate-500 opacity-75 hover:opacity-100'
                        }`}
                      >
                        {brokenAvatars[`pick:${c.id}`] ? (
                          <div className="w-full h-full flex items-center justify-center bg-violet-950/60 text-sm font-bold text-violet-200">
                            {c.name.charAt(0)}
                          </div>
                        ) : (
                          <img
                            src={c.url}
                            alt={c.name}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenAvatars((prev) => ({ ...prev, [`pick:${c.id}`]: true }))
                            }
                            className="w-full h-full object-cover"
                          />
                        )}
                        {isSelected && (
                          <div className="absolute top-1 right-1 p-0.5 rounded-full bg-violet-600 text-white">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="px-4 py-2 rounded-xl bg-[#171b29] text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white transition-colors"
                >
                  Create Local Profile
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
