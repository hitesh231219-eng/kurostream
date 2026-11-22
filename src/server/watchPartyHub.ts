import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import type {
  AnimeMedia,
  WatchPartyMessage,
  WatchPartyParticipant,
  WatchPartyRoomState,
} from '../types/anime';
import { getServerDisplayName, StreamingServerType } from '../services/megaplay';

export interface ServerWatchPartyRoom {
  roomId: string;
  roomName: string;
  hostId: string;
  hostToken: string;
  hostName: string;
  anime: AnimeMedia;
  episode: number;
  server: StreamingServerType;
  audio: 'sub' | 'dub';
  isPlaying: boolean;
  playbackPositionSec: number;
  updatedAtMs: number;
  expiresAtMs: number;
  messages: WatchPartyMessage[];
  seenClientMsgIds: Set<string>;
}

const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_MESSAGES_PER_ROOM = 100;

export class WatchPartyHub {
  private readonly rooms = new Map<string, ServerWatchPartyRoom>();
  private readonly connections = new Map<string, Map<WebSocket, WatchPartyParticipant>>();

  createRoom(input: {
    roomName: string;
    hostId: string;
    hostName: string;
    anime: AnimeMedia;
    episode: number;
    server: StreamingServerType;
    audio: 'sub' | 'dub';
  }): { room: WatchPartyRoomState; hostToken: string; messages: WatchPartyMessage[] } {
    this.pruneExpiredRooms();

    const code = `KURO-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const hostToken = crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    const systemMsg: WatchPartyMessage = {
      id: `sys-${now}`,
      senderName: 'KuroStream Sync',
      senderAvatar: input.anime.coverImage?.medium || input.anime.coverImage?.large || '',
      senderId: 'system',
      text: `Room ${code} initialized for ${input.anime.title.english || input.anime.title.romaji} (Ep. ${input.episode}). Share this code or link with friends to join across any device.`,
      timestamp: now,
    };

    const room: ServerWatchPartyRoom = {
      roomId: code,
      roomName: input.roomName.trim().slice(0, 120) || 'Anime Watch Room',
      hostId: input.hostId,
      hostToken,
      hostName: input.hostName.trim().slice(0, 64) || 'Host',
      anime: input.anime,
      episode: Math.max(1, input.episode || 1),
      server: input.server,
      audio: input.audio,
      isPlaying: false,
      playbackPositionSec: 0,
      updatedAtMs: now,
      expiresAtMs: now + ROOM_TTL_MS,
      messages: [systemMsg],
      seenClientMsgIds: new Set<string>(),
    };

    this.rooms.set(code, room);
    this.connections.set(code, new Map());

    return {
      room: this.serializeRoom(room),
      hostToken,
      messages: room.messages,
    };
  }

  getRoom(roomId: string): { room: WatchPartyRoomState; messages: WatchPartyMessage[] } | null {
    this.pruneExpiredRooms();
    const cleanId = roomId.trim().toUpperCase();
    const room = this.rooms.get(cleanId);
    if (!room) return null;
    if (Date.now() > room.expiresAtMs) {
      this.deleteRoom(cleanId);
      return null;
    }
    return {
      room: this.serializeRoom(room),
      messages: room.messages,
    };
  }

  computeEffectivePlaybackPosition(room: ServerWatchPartyRoom, now: number = Date.now()): number {
    if (!room.isPlaying) {
      return room.playbackPositionSec;
    }
    const elapsedSec = Math.max(0, (now - room.updatedAtMs) / 1000);
    return Number((room.playbackPositionSec + elapsedSec).toFixed(3));
  }

  serializeRoom(room: ServerWatchPartyRoom): WatchPartyRoomState {
    const connMap = this.connections.get(room.roomId);
    const participants: WatchPartyParticipant[] = connMap ? Array.from(connMap.values()) : [];
    return {
      roomId: room.roomId,
      roomName: room.roomName,
      hostId: room.hostId,
      hostName: room.hostName,
      anime: room.anime,
      episode: room.episode,
      server: room.server,
      audio: room.audio,
      isPlaying: room.isPlaying,
      timestamp: room.updatedAtMs,
      seekTime: this.computeEffectivePlaybackPosition(room),
      participants,
    };
  }

  registerSocket(
    roomId: string,
    ws: WebSocket,
    participant: { id: string; name: string; avatar: string; hostToken?: string }
  ): { ok: true; isHost: boolean; room: WatchPartyRoomState; messages: WatchPartyMessage[] } | { ok: false; error: string } {
    const cleanId = roomId.trim().toUpperCase();
    const room = this.rooms.get(cleanId);
    if (!room || Date.now() > room.expiresAtMs) {
      return { ok: false, error: 'Room not found or has expired.' };
    }

    const isHost = Boolean(participant.hostToken && participant.hostToken === room.hostToken);
    let connMap = this.connections.get(cleanId);
    if (!connMap) {
      connMap = new Map();
      this.connections.set(cleanId, connMap);
    }

    const member: WatchPartyParticipant = {
      id: participant.id,
      name: participant.name.slice(0, 64) || 'Viewer',
      avatar: participant.avatar,
      isHost,
      joinedAt: Date.now(),
      pingMs: 0,
    };
    connMap.set(ws, member);

    room.expiresAtMs = Date.now() + ROOM_TTL_MS;
    this.broadcastRoomState(cleanId);

    return {
      ok: true,
      isHost,
      room: this.serializeRoom(room),
      messages: room.messages,
    };
  }

  unregisterSocket(roomId: string, ws: WebSocket): void {
    const cleanId = roomId.trim().toUpperCase();
    const connMap = this.connections.get(cleanId);
    if (!connMap) return;
    if (connMap.delete(ws)) {
      this.broadcastRoomState(cleanId);
    }
  }

  updateParticipantPing(roomId: string, ws: WebSocket, pingMs: number): void {
    const cleanId = roomId.trim().toUpperCase();
    const connMap = this.connections.get(cleanId);
    const participant = connMap?.get(ws);
    if (participant) {
      participant.pingMs = Math.max(0, Math.min(9999, Math.round(pingMs)));
      this.broadcastRoomState(cleanId);
    }
  }

  applyHostControl(
    roomId: string,
    hostToken: string,
    action: {
      type: 'play' | 'pause' | 'seek' | 'episode' | 'server' | 'audio';
      seekTime?: number;
      episode?: number;
      server?: StreamingServerType;
      audio?: 'sub' | 'dub';
    }
  ): { ok: true; room: WatchPartyRoomState; notice: string } | { ok: false; error: string; status: number } {
    const cleanId = roomId.trim().toUpperCase();
    const room = this.rooms.get(cleanId);
    if (!room || Date.now() > room.expiresAtMs) {
      return { ok: false, error: 'Room not found or expired.', status: 404 };
    }
    if (!hostToken || hostToken !== room.hostToken) {
      return { ok: false, error: 'Forbidden: valid host authorization token required.', status: 403 };
    }

    const now = Date.now();
    const currentPos = this.computeEffectivePlaybackPosition(room, now);
    let notice = 'Playback updated';

    switch (action.type) {
      case 'play':
        room.playbackPositionSec = typeof action.seekTime === 'number' ? Math.max(0, action.seekTime) : currentPos;
        room.isPlaying = true;
        notice = `${room.hostName} started playback`;
        break;
      case 'pause':
        room.playbackPositionSec = typeof action.seekTime === 'number' ? Math.max(0, action.seekTime) : currentPos;
        room.isPlaying = false;
        notice = `${room.hostName} paused at ${Math.floor(room.playbackPositionSec)}s`;
        break;
      case 'seek':
        room.playbackPositionSec = Math.max(0, Number(action.seekTime) || 0);
        notice = `${room.hostName} sought to ${Math.floor(room.playbackPositionSec)}s`;
        break;
      case 'episode':
        if (typeof action.episode === 'number' && action.episode >= 1) {
          room.episode = Math.floor(action.episode);
          room.playbackPositionSec = 0;
          notice = `${room.hostName} switched to Episode ${room.episode}`;
        }
        break;
      case 'server':
        if (action.server) {
          room.server = action.server;
          room.playbackPositionSec = currentPos;
          notice = `${room.hostName} switched mirror to ${getServerDisplayName(action.server)}`;
        }
        break;
      case 'audio':
        if (action.audio) {
          room.audio = action.audio;
          room.playbackPositionSec = currentPos;
          notice = `${room.hostName} switched audio to ${action.audio.toUpperCase()}`;
        }
        break;
    }

    room.updatedAtMs = now;
    room.expiresAtMs = now + ROOM_TTL_MS;
    const serialized = { ...this.serializeRoom(room), lastAction: notice };
    this.broadcast(cleanId, { type: 'ROOM_STATE', payload: serialized, serverNowMs: now });
    return { ok: true, room: serialized, notice };
  }

  postChatMessage(
    roomId: string,
    input: {
      clientMsgId: string;
      senderId: string;
      senderName: string;
      senderAvatar: string;
      text: string;
    }
  ): { ok: true; message: WatchPartyMessage; deduplicated: boolean } | { ok: false; error: string } {
    const cleanId = roomId.trim().toUpperCase();
    const room = this.rooms.get(cleanId);
    if (!room) return { ok: false, error: 'Room not found' };

    const trimmed = input.text.trim();
    if (!trimmed || trimmed.length > 500) {
      return { ok: false, error: 'Message must be 1–500 characters' };
    }

    if (input.clientMsgId && room.seenClientMsgIds.has(input.clientMsgId)) {
      const existing = room.messages.find(m => m.id === input.clientMsgId) || room.messages[room.messages.length - 1];
      return { ok: true, message: existing, deduplicated: true };
    }

    const msgId = input.clientMsgId || `msg-${crypto.randomUUID()}`;
    room.seenClientMsgIds.add(msgId);
    if (room.seenClientMsgIds.size > 500) {
      const first = room.seenClientMsgIds.values().next().value;
      if (first) room.seenClientMsgIds.delete(first);
    }

    const message: WatchPartyMessage = {
      id: msgId,
      senderId: input.senderId,
      senderName: input.senderName.slice(0, 64) || 'Viewer',
      senderAvatar: input.senderAvatar,
      text: trimmed,
      timestamp: Date.now(),
    };

    room.messages.push(message);
    if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
      room.messages.shift();
    }

    this.broadcast(cleanId, { type: 'CHAT_MESSAGE', payload: message });
    return { ok: true, message, deduplicated: false };
  }

  postReaction(
    roomId: string,
    input: { reactionId: string; emoji: string; senderName: string; senderAvatar: string }
  ): boolean {
    const cleanId = roomId.trim().toUpperCase();
    const room = this.rooms.get(cleanId);
    if (!room) return false;

    if (room.seenClientMsgIds.has(input.reactionId)) {
      return true;
    }
    room.seenClientMsgIds.add(input.reactionId);

    this.broadcast(cleanId, {
      type: 'REACTION',
      payload: {
        id: input.reactionId,
        emoji: input.emoji.slice(0, 8),
        senderName: input.senderName.slice(0, 64),
        senderAvatar: input.senderAvatar,
        timestamp: Date.now(),
      },
    });
    return true;
  }

  private broadcastRoomState(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.broadcast(roomId, {
      type: 'ROOM_STATE',
      payload: this.serializeRoom(room),
      serverNowMs: Date.now(),
    });
  }

  private broadcast(roomId: string, payload: unknown): void {
    const connMap = this.connections.get(roomId);
    if (!connMap) return;
    const raw = JSON.stringify(payload);
    for (const ws of connMap.keys()) {
      if (ws.readyState === 1 /* WebSocket.OPEN */) {
        try {
          ws.send(raw);
        } catch {
          // socket closed mid-send
        }
      }
    }
  }

  deleteRoom(roomId: string): void {
    const cleanId = roomId.trim().toUpperCase();
    this.rooms.delete(cleanId);
    this.connections.delete(cleanId);
  }

  pruneExpiredRooms(now: number = Date.now()): void {
    for (const [id, room] of this.rooms.entries()) {
      if (now > room.expiresAtMs) {
        this.deleteRoom(id);
      }
    }
  }

  get activeRoomCount(): number {
    return this.rooms.size;
  }
}
