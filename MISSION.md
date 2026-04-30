# MISSION.md — Mission Control Bot

> Community-driven game request management system for a 2000+ member Discord server.

---

## 🎯 Purpose

A bot that lets community members submit game requests (new games, updates, fix requests), vote on them, and allows admins to process top requests into actual releases. The community decides priority via upvotes — no more "I'll add it someday."

---

## 👤 Owner

- **Name:** Pawan Shekhawat (laxmanplays)
- **Discord:** laxmanplays#0
- **Server:** 2000+ members (separate from OpenClaw bot server)

---

## 🧱 Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Runtime | Node.js 20 LTS | AWS EC2 already has Node |
| Framework | discord.js v14 | Bot framework |
| Database | PostgreSQL 15 | Relational DB for requests/votes/users |
| ORM | Prisma | Schema-first, clean migrations |
| Process manager | PM2 | Keeps bot alive, auto-restarts |
| Host | AWS EC2 t3.micro | Existing instance |
| Version control | GitHub (`pawanshekhawat/mission-control`) | Already exists |

---

## 🗂️ Core Modules

### 1. Request Management System

**Commands:**
- `/request` — New game submission
- `/update-request` — Version/update request
- `/fix-request` — Broken link report

**Each request stores:**
- Request ID (UUID)
- Type: `game` | `update` | `fix`
- Game name
- Store link (Steam, Epic, etc.)
- Comment (optional)
- User Discord ID
- Timestamp
- Initial status: `NEW`

### 2. Voting & Priority Engine

**Mechanism:**
- `👍` / `UP` reaction = vote currency
- One vote per user per request (toggle: add/remove)
- Votes stored in DB, not just Discord reactions
- Anti-spam: no duplicate votes, no self-voting

**Priority leaderboard:**
- Sorted by vote count (primary), timestamp (tie-breaker)
- Auto-updates on every vote
- Single editable message (no spam posting)

### 3. Content Lifecycle Pipeline

```
NEW → REVIEW → ACCEPTED → IN_PROGRESS → DONE
                                               ↘ REJECTED
```

**Rules:**
- Only admins can change state
- DONE locks voting (frozen)
- No skipping states

### 4. Search & Discovery

- `/search <game name>` — Find existing requests, status, vote count
- Prevents duplicate submissions

### 5. Admin Control Layer

**Buttons/commands:**
- Approve → REVIEW
- Reject → REJECTED
- Start Work → IN_PROGRESS
- Complete → DONE
- Force priority override
- Delete / merge duplicates

**Role-based permissions:**
- Admin role required for state changes
- Users can only create requests and vote

### 6. Completion Publishing

| Type | Output Channel |
|------|----------------|
| Game | `#new-games-added` |
| Update | `#updates-released` |
| Fix | `#fixes-done` |

**Output includes:** Game name, version/fix info, link, reference to original request

### 7. Anti-Abuse System

- Request cooldown (e.g., 1 per 2 minutes per user)
- Duplicate detection (same game + type)
- Vote spam prevention
- Max open requests per user (optional cap)
- Blacklist capability

---

## 🗐️ Database Schema (Prisma)

```prisma
model User {
  id        String    @id @default(uuid())
  discordId String    @unique
  requests  Request[]
  votes     Vote[]
  createdAt DateTime  @default(now())
}

model Request {
  id        String    @id @default(uuid())
  type      String    // "game" | "update" | "fix"
  gameName  String
  storeLink String?
  comment   String?
  status    String    @default("NEW") // NEW | REVIEW | ACCEPTED | IN_PROGRESS | DONE | REJECTED
  voteCount Int       @default(0)
  messageId String?   // Discord message ID for this request
  channelId String?   // Discord channel ID where posted
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  votes     Vote[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Vote {
  id        String   @id @default(uuid())
  requestId String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  request   Request  @relation(fields: [requestId], references: [id])
  createdAt DateTime @default(now())

  @@unique([requestId, userId])
}

model Config {
  id        String @id @default(uuid())
  guildId   String @unique
  adminRole String?
  logChannel String?
}
```

---

## 📋 Channel Structure (to create)

**Input channels:**
- `#new-game-requests`
- `#update-requests`
- `#fix-requests`

**Output channels:**
- `#priority` (live leaderboard)
- `#new-games-added`
- `#updates-released`
- `#fixes-done`

**Bot commands channel:**
- `#bot-commands` (for slash commands)

---

## 🔧 Development Phases

### Phase 1 — Foundation
- [ ] Project setup (Node.js, discord.js, Prisma, PostgreSQL)
- [ ] Basic command handler
- [ ] Database migrations
- [ ] Connect bot to test server

### Phase 2 — Core Input
- [ ] Request creation commands (game/update/fix)
- [ ] Request embeds with UUID
- [ ] Duplicate detection
- [ ] Post requests to appropriate channels

### Phase 3 — Voting
- [ ] Reaction-based voting (add/remove)
- [ ] Vote tracking in DB
- [ ] Priority leaderboard message (auto-updates)

### Phase 4 — Admin Controls
- [ ] Admin role setup
- [ ] Status transition buttons
- [ ] Admin-only commands
- [ ] Completion publishing

### Phase 5 — Polish & Scale
- [ ] Search system
- [ ] Anti-spam safeguards
- [ ] Cooldowns and rate limits
- [ ] Logging

---

## ⚠️ Critical Rules

**Data integrity is king.** If any of these fail, the system collapses:
- Votes not synced ↔ leaderboard breaks
- Status mismatched ↔ chaos
- Message ↔ DB mapping lost ↔ can't update

**Priority order:**
1. Data integrity
2. Voting system
3. Admin controls
4. UI/features (search, embeds, leaderboard)

---

## 📦 Deliverable

A production-ready Node.js bot hosted on AWS EC2, connected to PostgreSQL, with:
- Slash commands for request creation
- Reaction-based voting
- Live priority leaderboard
- Admin workflow (buttons for status changes)
- Completion publishing to topic channels
