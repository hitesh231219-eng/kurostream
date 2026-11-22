import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AnimeMedia,
  WatchPartyMessage,
  WatchPartyRoomState,
  WatchPartyReaction,
} from '../types/anime';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Send,
  Play,
  Pause,
  Copy,
  Check,
  Tv,
  Radio,
  Volume2,
  VolumeX,
  MessageSquare,
  ChevronRight,
  LogOut,
  Crown,
  FastForward,
  Rewind,
  Smile,
  Signal,
  AlertCircle,
  Loader2,
  Clock,
  Wifi,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  isServerSupportedForMedia,
  resolveBestAvailableStream,
  STREAMING_SERVERS,
  StreamingServerType,
} from '../services/megaplay';
import { db, handleFirestoreError, OperationType } from '../services/firebase';

interface WatchPartyViewProps {
  animeList: AnimeMedia[];
  onOpenPlayer: (anime: AnimeMedia, episode: number) => void;
  initialSeed?: { anime: AnimeMedia; episode: number } | null;
  initialRoomCode?: string | null;
  onRoomCodeChange?: (roomId: string | null) => void;
}

const REACTION_EMOJIS = ['🔥', '😱', '😭', '💀', '🍿', '💖', '🚀', '⚡', '👏'];

function getHostTokenStorageKey(roomId: string): string {
  return `kuro_party_host_token_${roomId.toUpperCase()}`;
}

export const WatchPartyView: React.FC<WatchPartyViewProps> = ({
  animeList,
  initialSeed,
  initialRoomCode,
  onRoomCodeChange,
}) => {
  const { user, firebaseUser, addXp, incrementQuestProgress } = useAuth();

  const [roomState, setRoomState] = useState<WatchPartyRoomState | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [messages, setMessages] = useState<WatchPartyMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<WatchPartyReaction[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastNotification, setLastNotification] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('idle');
  const [partyError, setPartyError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [displayPositionSec, setDisplayPositionSec] = useState<number>(0);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState<number>(0);

  const combinedAnimeList = React.useMemo(() => {
    if (!initialSeed?.anime) return animeList;
    if (animeList.some((a) => a.id === initialSeed.anime.id)) return animeList;
    return [initialSeed.anime, ...animeList];
  }, [animeList, initialSeed]);

  // Room Creation Form State
  const [selectedAnimeId, setSelectedAnimeId] = useState<number>(
    initialSeed?.anime.id || animeList[0]?.id || 154587
  );
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialSeed?.episode || 1);
  const [roomNameInput, setRoomNameInput] = useState(
    initialSeed?.anime
      ? `${initialSeed.anime.title.english || initialSeed.anime.title.romaji} Watch Night`
      : 'Anime Watch Party'
  );
  const [serverChoice, setServerChoice] = useState<StreamingServerType>('anixo');
  const [audioChoice, setAudioChoice] = useState<'sub' | 'dub'>('sub');
  const [joinCodeInput, setJoinCodeInput] = useState(initialRoomCode || '');

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const wsRef = useRef<WebSocket | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialSeed?.anime) {
      setSelectedAnimeId(initialSeed.anime.id);
      setSelectedEpisode(initialSeed.episode || 1);
      setRoomNameInput(
        `${initialSeed.anime.title.english || initialSeed.anime.title.romaji} Watch Night`
      );
    }
  }, [initialSeed]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const playChime = useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }, []);

  // Keep synchronized clock readout smooth & drift-corrected
  useEffect(() => {
    if (!roomState) {
      setDisplayPositionSec(0);
      return;
    }

    const updateTimer = () => {
      const base = roomState.seekTime || 0;
      if (!roomState.isPlaying) {
        setDisplayPositionSec(base);
        return;
      }
      const estimatedServerNow = Date.now() + serverClockOffsetMs;
      const elapsed = Math.max(0, (estimatedServerNow - roomState.timestamp) / 1000);
      setDisplayPositionSec(base + elapsed);
    };

    updateTimer();
    const id = setInterval(updateTimer, 500);
    return () => clearInterval(id);
  }, [roomState, serverClockOffsetMs]);

  const forwardPlayerCommand = useCallback(
    (action: { type: 'play' | 'pause' | 'seek'; seekTime?: number }) => {
      const targetWin = iframeRef.current?.contentWindow;
      if (!targetWin) return;
      try {
        targetWin.postMessage({ source: 'kurostream-party', ...action }, '*');
      } catch {}
    },
    []
  );

  // Connect & maintain real WebSocket synchronization for active room
  useEffect(() => {
    const activeRoomId = roomState?.roomId;
    if (!activeRoomId) {
      setConnectionStatus('idle');
      return;
    }

    let cancelled = false;

    const connectWs = () => {
      if (cancelled) return;
      setConnectionStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/party`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        reconnectAttemptRef.current = 0;
        setConnectionStatus('connected');
        const savedToken = hostToken || sessionStorage.getItem(getHostTokenStorageKey(activeRoomId)) || undefined;
        ws.send(
          JSON.stringify({
            type: 'JOIN_ROOM',
            roomId: activeRoomId,
            participantId: user?.id || `viewer-${Date.now()}`,
            participantName: user?.name || 'Viewer',
            participantAvatar: user?.avatar || '',
            hostToken: savedToken,
          })
        );
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(String(evt.data));
          if (msg.type === 'ROOM_SNAPSHOT') {
            setRoomState(msg.room);
            setIsHost(Boolean(msg.isHost));
            if (Array.isArray(msg.messages)) setMessages(msg.messages);
            if (typeof msg.serverNowMs === 'number') {
              setServerClockOffsetMs(msg.serverNowMs - Date.now());
            }
          } else if (msg.type === 'ROOM_STATE' && msg.payload) {
            const incoming: WatchPartyRoomState = msg.payload;
            if (typeof msg.serverNowMs === 'number') {
              setServerClockOffsetMs(msg.serverNowMs - Date.now());
            }
            setRoomState((prev) => {
              if (prev && prev.isPlaying !== incoming.isPlaying) {
                forwardPlayerCommand({
                  type: incoming.isPlaying ? 'play' : 'pause',
                  seekTime: incoming.seekTime,
                });
              }
              return incoming;
            });
            if (incoming.lastAction) {
              setLastNotification(incoming.lastAction);
              setTimeout(() => setLastNotification(null), 3000);
            }
          } else if (msg.type === 'CHAT_MESSAGE' && msg.payload) {
            const incomingMsg: WatchPartyMessage = msg.payload;
            setMessages((prev) =>
              prev.some((m) => m.id === incomingMsg.id) ? prev : [...prev, incomingMsg]
            );
            playChime();
          } else if (msg.type === 'REACTION' && msg.payload) {
            const reaction: WatchPartyReaction = msg.payload;
            setFloatingReactions((prev) =>
              prev.some((r) => r.id === reaction.id) ? prev : [...prev, reaction]
            );
            playChime();
            setTimeout(() => {
              setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id));
            }, 2500);
          } else if (msg.type === 'PONG' && typeof msg.clientSentAt === 'number' && typeof msg.serverNowMs === 'number') {
            const rtt = Date.now() - msg.clientSentAt;
            setServerClockOffsetMs(msg.serverNowMs - (msg.clientSentAt + rtt / 2));
          } else if (msg.type === 'ERROR') {
            setPartyError(msg.error || 'Watch Party synchronization error');
          }
        } catch {}
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnectionStatus('reconnecting');
        const delayMs = Math.min(8000, 1000 * Math.pow(2, reconnectAttemptRef.current));
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connectWs, delayMs);
      };

      ws.onerror = () => {
        setConnectionStatus('error');
      };
    };

    connectWs();

    // Periodic ping heartbeat for latency & clock drift correction
    const pingTimer = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING', clientSentAt: Date.now() }));
      }
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(pingTimer);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomState?.roomId, hostToken, user?.id, user?.name, user?.avatar, playChime, forwardPlayerCommand]);

  const joinRoomByCode = useCallback(
    async (rawCode: string) => {
      const cleanCode = rawCode.trim().toUpperCase();
      if (!cleanCode) return;
      setPartyError(null);
      setBusyAction(true);

      try {
        const res = await fetch(`/api/party/rooms/${encodeURIComponent(cleanCode)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.room) {
          setPartyError(
            data?.error || `Watch Party room "${cleanCode}" was not found or has expired.`
          );
          return;
        }

        const savedToken = sessionStorage.getItem(getHostTokenStorageKey(cleanCode));
        setHostToken(savedToken);
        setIsHost(Boolean(savedToken));
        setRoomState(data.room);
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        onRoomCodeChange?.(data.room.roomId);

        addXp(25, `Joined Watch Party ${cleanCode}`, `party:join:${cleanCode}`);
        incrementQuestProgress('party');
      } catch {
        setPartyError('Unable to reach Watch Party server. Please try again.');
      } finally {
        setBusyAction(false);
      }
    },
    [addXp, incrementQuestProgress, onRoomCodeChange]
  );

  // Auto-join from URL param or ?party=ROOM
  useEffect(() => {
    const code = initialRoomCode || new URLSearchParams(window.location.search).get('party');
    if (code && !roomState) {
      setJoinCodeInput(code.toUpperCase());
      joinRoomByCode(code);
    }
  }, [initialRoomCode]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenAnime =
      combinedAnimeList.find((a) => a.id === selectedAnimeId) || combinedAnimeList[0];
    if (!chosenAnime) {
      setPartyError('Select an anime title before creating a room.');
      return;
    }

    setPartyError(null);
    setBusyAction(true);

    try {
      const res = await fetch('/api/party/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: roomNameInput.trim() || 'Anime Watch Room',
          hostId: user?.id || `host-${Date.now()}`,
          hostName: user?.name || 'Host',
          anime: chosenAnime,
          episode: selectedEpisode,
          server: serverChoice,
          audio: audioChoice,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.room || !data.hostToken) {
        setPartyError(data?.error || 'Failed to create Watch Party room on server.');
        return;
      }

      sessionStorage.setItem(getHostTokenStorageKey(data.room.roomId), data.hostToken);
      setHostToken(data.hostToken);
      setIsHost(true);
      setRoomState(data.room);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      onRoomCodeChange?.(data.room.roomId);

      // Optional Firestore persistence for verified Google users
      if (firebaseUser && firebaseUser.emailVerified) {
        const roomPath = `watchRooms/${data.room.roomId}`;
        const roomDoc: Record<string, any> = {
          roomId: data.room.roomId,
          roomName: data.room.roomName,
          hostUid: firebaseUser.uid,
          hostName: data.room.hostName,
          animeId: chosenAnime.id,
          animeTitle: (chosenAnime.title.english || chosenAnime.title.romaji).slice(0, 240),
          episode: data.room.episode,
          server: data.room.server,
          audio: data.room.audio,
          isPlaying: data.room.isPlaying,
          playbackPositionSec: 0,
          expiresAtMs: Date.now() + 6 * 60 * 60 * 1000,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (chosenAnime.idMal && chosenAnime.idMal > 0) {
          roomDoc.malId = chosenAnime.idMal;
        }
        setDoc(doc(db, 'watchRooms', data.room.roomId), roomDoc).catch((err) => {
          try {
            handleFirestoreError(err, OperationType.CREATE, roomPath);
          } catch (wrapped) {
            console.error(wrapped);
          }
        });
      }

      addXp(50, 'Hosted Watch Party Room', `party:host:${data.room.roomId}`);
      incrementQuestProgress('party');
    } catch {
      setPartyError('Network error while launching Watch Party server.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleJoinRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    joinRoomByCode(joinCodeInput);
  };

  const sendHostControl = async (action: {
    controlType: 'play' | 'pause' | 'seek' | 'episode' | 'server' | 'audio';
    seekTime?: number;
    episode?: number;
    server?: StreamingServerType;
    audio?: 'sub' | 'dub';
  }) => {
    if (!roomState || !isHost || !hostToken) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'HOST_CONTROL',
          hostToken,
          ...action,
        })
      );
    } else {
      const res = await fetch(`/api/party/rooms/${roomState.roomId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostToken,
          type: action.controlType,
          seekTime: action.seekTime,
          episode: action.episode,
          server: action.server,
          audio: action.audio,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.room) {
        setRoomState(data.room);
      }
    }

    if (firebaseUser && firebaseUser.emailVerified && roomState.hostId === firebaseUser.uid) {
      const roomPath = `watchRooms/${roomState.roomId}`;
      updateDoc(doc(db, 'watchRooms', roomState.roomId), {
        episode: action.episode ?? roomState.episode,
        server: action.server ?? roomState.server,
        audio: action.audio ?? roomState.audio,
        isPlaying:
          action.controlType === 'play'
            ? true
            : action.controlType === 'pause'
            ? false
            : roomState.isPlaying,
        playbackPositionSec: Math.round(action.seekTime ?? displayPositionSec),
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        try {
          handleFirestoreError(err, OperationType.UPDATE, roomPath);
        } catch {}
      });
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !roomState || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const clientMsgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    wsRef.current.send(
      JSON.stringify({
        type: 'CHAT_MESSAGE',
        clientMsgId,
        senderId: user?.id || 'viewer',
        senderName: user?.name || 'Viewer',
        senderAvatar: user?.avatar || '',
        text: inputMessage.trim(),
      })
    );
    setInputMessage('');
    incrementQuestProgress('party');
  };

  const sendReaction = (emoji: string) => {
    if (!roomState || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const reactionId = `react-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    wsRef.current.send(
      JSON.stringify({
        type: 'REACTION',
        reactionId,
        emoji,
        senderName: user?.name || 'Viewer',
        senderAvatar: user?.avatar || '',
      })
    );
  };

  const copyRoomCode = () => {
    if (!roomState?.roomId) return;
    const inviteLink = `${window.location.origin}/watch-party/${roomState.roomId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const resolvedRoomStream = roomState
    ? resolveBestAvailableStream({
        serverId: roomState.server,
        anilistId: roomState.anime.id,
        malId: roomState.anime.idMal,
        episode: roomState.episode,
        audio: roomState.audio,
        format: roomState.anime.format,
      })
    : null;

  const formatClock = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      {partyError && (
        <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{partyError}</span>
          </div>
          <button onClick={() => setPartyError(null)} className="text-rose-300 hover:text-white font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {!roomState ? (
        <div className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <p className="text-xs font-semibold text-violet-400 tracking-wide">
              WebSocket Synchronized Room Playback · Cross-Device Support
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
              Watch Anime Synchronously with Friends
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Create a server-authoritative room with real-time WebSocket clock synchronization, live participants, and deduplicated chat.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Create Room Card */}
            <div className="p-6 rounded-3xl bg-[#0e111a] border border-[#232738] shadow-2xl space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                    <span>Host a Watch Party</span>
                    <Crown className="w-4 h-4 text-amber-400" />
                  </h2>
                  <p className="text-xs text-slate-400">Authoritative room clock & host token controls</p>
                </div>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Room Title</label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={roomNameInput}
                    onChange={(e) => setRoomNameInput(e.target.value)}
                    placeholder="e.g. Jujutsu Kaisen Shibuya Arc Party"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#141824] border border-[#232738] text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Select Anime Title</label>
                  <select
                    value={selectedAnimeId}
                    onChange={(e) => setSelectedAnimeId(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#141824] border border-[#232738] text-white focus:outline-none focus:border-violet-500"
                  >
                    {combinedAnimeList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title.english || a.title.romaji}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Episode</label>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={selectedEpisode}
                      onChange={(e) => setSelectedEpisode(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#141824] border border-[#232738] text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Audio Track</label>
                    <select
                      value={audioChoice}
                      onChange={(e) => setAudioChoice(e.target.value as 'sub' | 'dub')}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#141824] border border-[#232738] text-white"
                    >
                      <option value="sub">Subtitled (SUB)</option>
                      <option value="dub">English Dub (DUB)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Streaming Server</label>
                  <div className="grid grid-cols-2 gap-2">
                    {STREAMING_SERVERS.map((srv) => {
                      const chosenAnime = combinedAnimeList.find((a) => a.id === selectedAnimeId);
                      const compatible = chosenAnime
                        ? isServerSupportedForMedia(srv.id, chosenAnime.id, chosenAnime.idMal).supported
                        : true;
                      return (
                        <button
                          key={srv.id}
                          type="button"
                          disabled={!compatible}
                          onClick={() => setServerChoice(srv.id)}
                          className={`p-2 rounded-xl border text-left transition-colors disabled:opacity-40 ${
                            serverChoice === srv.id
                              ? 'bg-violet-600/30 border-violet-500 text-white font-bold'
                              : 'bg-[#141824] border-[#22283a] text-slate-400'
                          }`}
                        >
                          <p className="text-[11px] font-bold">{srv.badge}</p>
                          <p className="text-[9px] text-slate-400">
                            {compatible ? srv.origin.replace('https://', '') : 'Requires MAL ID'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busyAction}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-2"
                >
                  {busyAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                  <span>Launch Live Watch Room (+50 XP)</span>
                </button>
              </form>
            </div>

            {/* Join Room Card */}
            <div className="p-6 rounded-3xl bg-[#0e111a] border border-[#232738] shadow-2xl flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Join Existing Room</h2>
                    <p className="text-xs text-slate-400">Enter a verified room code shared by a host</p>
                  </div>
                </div>

                <form onSubmit={handleJoinRoomSubmit} className="space-y-4 text-xs pt-2">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Room Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. KURO-A1B2C3"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#141824] border border-[#232738] text-sm text-white font-mono uppercase tracking-wider placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busyAction || !joinCodeInput.trim()}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
                  >
                    {busyAction ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>Connect to Watch Party (+25 XP)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </form>
              </div>

              <div className="p-4 rounded-2xl bg-[#131622] border border-[#202538] space-y-2 text-[11px] text-slate-400">
                <span className="font-semibold text-white block">Real Backend Synchronization:</span>
                <p>• Invalid or expired codes are verified cleanly against `/api/party/rooms`.</p>
                <p>• Server-clock RTT drift correction & live participant ping monitoring.</p>
                <p>• Cryptographic host token prevents unauthorized playback tampering.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Room Header */}
          <div className="p-4 rounded-2xl bg-[#0e111a] border border-[#232738] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Radio
                className={`w-4 h-4 shrink-0 ${
                  connectionStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'
                }`}
              />
              <div>
                <h2 className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                  <span>{roomState.roomName}</span>
                  <span className="text-xs font-mono text-violet-300 tabular-nums">
                    · {roomState.roomId}
                  </span>
                  {isHost && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300">
                      · <Crown className="w-3.5 h-3.5 text-amber-400" /> Host
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                  <span>
                    {roomState.anime.title.english || roomState.anime.title.romaji} · Ep {roomState.episode} ({roomState.audio.toUpperCase()})
                  </span>
                  <span>·</span>
                  <span className="font-mono text-emerald-300 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatClock(displayPositionSec)} ({roomState.isPlaying ? 'Playing' : 'Paused'})
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#141824] border border-[#22283a] text-slate-300">
                <Wifi className="w-3 h-3 text-emerald-400" />
                {connectionStatus}
              </span>

              <button
                onClick={copyRoomCode}
                className="px-3.5 py-1.5 rounded-xl bg-[#141824] hover:bg-[#1f2538] border border-[#22283a] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedLink ? 'Copied Invite!' : 'Copy Invite Link'}</span>
              </button>

              <button
                onClick={() => {
                  setRoomState(null);
                  setHostToken(null);
                  setIsHost(false);
                  setMessages([]);
                  onRoomCodeChange?.(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Player & Host Sync Controls */}
            <div className="lg:col-span-2 space-y-3">
              <div className="relative aspect-video rounded-3xl overflow-hidden bg-black border border-[#22283a] shadow-2xl">
                {resolvedRoomStream?.url ? (
                  <iframe
                    ref={iframeRef}
                    key={resolvedRoomStream.url}
                    src={resolvedRoomStream.url}
                    title="Watch Party Player"
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen
                    referrerPolicy="origin"
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#090b11]">
                    <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
                    <p className="text-sm font-bold text-white">Selected stream server unavailable for this title</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {isHost
                        ? 'Switch to another server (e.g., Ryu or War) below.'
                        : 'Waiting for the host to switch to a compatible streaming mirror.'}
                    </p>
                  </div>
                )}

                <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                  {floatingReactions.map((r) => (
                    <div
                      key={r.id}
                      className="absolute bottom-8 text-3xl sm:text-4xl animate-in zoom-in-50 fade-in slide-in-from-bottom-12 duration-500"
                      style={{
                        left: `${20 + (Math.abs(r.id.charCodeAt(r.id.length - 1)) % 60)}%`,
                        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))',
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-2xl">{r.emoji}</span>
                        <span className="text-[9px] font-bold text-white bg-black/75 px-1.5 rounded font-mono">
                          {r.senderName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {lastNotification && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-violet-600/90 backdrop-blur-md text-white text-xs font-bold border border-violet-400 shadow-xl">
                    {lastNotification}
                  </div>
                )}
              </div>

              {/* Reaction Bar */}
              <div className="p-2.5 rounded-2xl bg-[#0e111a] border border-[#232738] flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 shrink-0 ml-1">
                  <Smile className="w-3.5 h-3.5 text-amber-400" />
                  <span>React Live:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(emoji)}
                      className="p-1.5 sm:px-2 sm:py-1 rounded-xl bg-[#141824] hover:bg-[#1f2538] hover:scale-125 transition-transform text-base"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Server-Authoritative Controls */}
              <div className="p-3.5 rounded-2xl bg-[#0e111a] border border-[#232738] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 font-semibold">Server:</span>
                  {STREAMING_SERVERS.map((srv) => {
                    const compatible = isServerSupportedForMedia(
                      srv.id,
                      roomState.anime.id,
                      roomState.anime.idMal
                    ).supported;
                    return (
                      <button
                        key={srv.id}
                        disabled={!isHost || !compatible}
                        onClick={() => sendHostControl({ controlType: 'server', server: srv.id })}
                        className={`px-2 py-1 rounded-lg text-xs font-mono transition-colors disabled:opacity-40 ${
                          roomState.server === srv.id
                            ? 'bg-violet-600 text-white font-bold'
                            : 'bg-[#141824] text-slate-400 hover:text-white'
                        }`}
                      >
                        {srv.badge}
                      </button>
                    );
                  })}
                </div>

                {isHost ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        sendHostControl({
                          controlType: 'episode',
                          episode: Math.max(1, roomState.episode - 1),
                        })
                      }
                      disabled={roomState.episode <= 1}
                      className="px-2.5 py-1 rounded-lg bg-[#141824] hover:bg-[#1f2538] text-slate-200 disabled:opacity-30"
                      title="Previous Episode"
                    >
                      <Rewind className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() =>
                        sendHostControl({
                          controlType: roomState.isPlaying ? 'pause' : 'play',
                          seekTime: displayPositionSec,
                        })
                      }
                      className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-violet-600/30"
                    >
                      {roomState.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{roomState.isPlaying ? 'Sync Pause' : 'Sync Play'}</span>
                    </button>

                    <button
                      onClick={() =>
                        sendHostControl({
                          controlType: 'episode',
                          episode: roomState.episode + 1,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-[#141824] hover:bg-[#1f2538] text-slate-200"
                      title="Next Episode"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                    <Signal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Host Controlled · Clock Offset {Math.round(serverClockOffsetMs)}ms</span>
                  </div>
                )}
              </div>

              {/* Live Connected Participants Strip */}
              <div className="p-3.5 rounded-2xl bg-[#0e111a] border border-[#232738] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    Connected Viewers ({roomState.participants?.length || 1})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(roomState.participants || []).map((p, idx) => (
                    <div
                      key={`${p.id}-${idx}`}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#141824] border border-[#22283a] text-xs"
                    >
                      {p.avatar && (
                        <img
                          src={p.avatar}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      )}
                      <span className="font-semibold text-white">{p.name}</span>
                      {p.isHost && <Crown className="w-3 h-3 text-amber-400" />}
                      {typeof p.pingMs === 'number' && p.pingMs > 0 && (
                        <span className="text-[10px] font-mono text-emerald-400">{p.pingMs}ms</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Chat Sidebar */}
            <div className="bg-[#0c0e15] border border-[#232738] rounded-3xl flex flex-col h-[640px] overflow-hidden shadow-2xl">
              <div className="p-3.5 border-b border-[#1b1f2e] bg-[#111422] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-violet-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Party Chat</h3>
                </div>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1 text-slate-400 hover:text-white"
                  title={soundEnabled ? 'Mute Chat Sound' : 'Enable Chat Sound'}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-2.5 text-xs">
                    {msg.senderAvatar ? (
                      <img
                        src={msg.senderAvatar}
                        alt={msg.senderName}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        className="w-7 h-7 rounded-xl object-cover border border-[#232738] shrink-0 mt-0.5"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-xl bg-violet-600/30 border border-violet-500/40 shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold text-violet-200">
                        {msg.senderName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{msg.senderName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-300 mt-0.5 break-words leading-relaxed bg-[#131622] p-2.5 rounded-2xl rounded-tl-none border border-[#1d2233]">
                        {msg.text}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-3 border-t border-[#1b1f2e] bg-[#0f121c] flex items-center gap-2">
                <input
                  type="text"
                  maxLength={500}
                  placeholder={`Chat as ${user?.name || 'Viewer'}...`}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#151926] border border-[#232738] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || connectionStatus !== 'connected'}
                  className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white transition-colors shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
