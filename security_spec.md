# KuroStream Security Rules Specification (Payload-First TDD)

## 1. Data Invariants
1. **Identity & PII Isolation**: `/users/{uid}/private/profile` stores email and profile metadata and is strictly accessible only to `request.auth.uid == uid` with `request.auth.token.email_verified == true`.
2. **Watchlist, Daily Quest & Manga Progress Isolation**: Watchlists, playback timestamps, daily quests (`YYYY-MM-DD`), and manga reading progress under `/users/{uid}/...` can only be read, queried, created, updated, or deleted by `request.auth.uid == uid` with `email_verified == true` and matching `data.uid == uid`.
3. **Anti-Tampering XP Bounds**: Single profile updates cannot arbitrarily jump `xp` above `+200` per write, preventing trivial DevTools XP inflation while supporting legitimate episode/chapter/quest rewards.
4. **Watch Room Host Authority**: Any authenticated verified user may read a specific `watchRooms/{roomId}` document by ID (no blanket collection `list`), while updates to playback state (`episode`, `server`, `audio`, `isPlaying`, `playbackPositionSec`) are strictly restricted to `existing().hostUid == request.auth.uid`, preserving immutable `hostUid`, `roomId`, and `createdAt`.
5. **Temporal Integrity & Input Size Caps**: All `createdAt`/`updatedAt` timestamps must equal `request.time`; all string fields and path IDs enforce explicit regex and `.size()` limits.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read/write to `/users/uid1/private/profile`.
2. Authenticated User A reading User B's `/users/uid2/private/profile`.
3. Authenticated User A with `email_verified: false` creating `/users/uid1/private/profile`.
4. User A injecting a shadow field (`isAdmin: true` or `role: 'superadmin'`) on `/users/uid1/private/profile`.
5. User A spoofing `uid: 'uid2'` inside `/users/uid1/watchlist/21`.
6. User A jumping `xp` from `100` to `999999` in a single update on `/users/uid1/private/profile`.
7. User A backdating `createdAt` or `updatedAt` instead of using `request.time`.
8. User A executing a blanket `list` query on `/watchRooms` to scrape all private rooms.
9. Guest User B updating `isPlaying` or `hostUid` on User A's `watchRooms/KURO-TEST1`.
10. Injecting a 2KB oversized `title` string (> 240 chars) into `/users/uid1/watchlist/21`.
11. Injecting an invalid status enum (`status: 'hacked'`) into `/users/uid1/watchlist/21`.
12. Injecting an invalid `dateKey` (`not-a-date`) or >10 items in `claimedIds` on `/users/uid1/dailyQuests/...`.
