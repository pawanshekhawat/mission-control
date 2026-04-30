# 🎀 Mission Control Bot

> Community-driven game request management system for Discord

A bot that lets community members submit game requests (new games, updates, fix requests), vote on them via reactions, and lets admins process top requests into releases. Community priority through upvotes.

---

## 🧱 Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20 LTS |
| Framework | discord.js v14 |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Host | AWS EC2 t3.micro |

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure
Edit `config.json`:
```json
{
  "token": "YOUR_DISCORD_BOT_TOKEN",
  "clientId": "YOUR_DISCORD_CLIENT_ID",
  "guildId": "YOUR_DISCORD_GUILD_ID",
  "DATABASE_URL": "postgresql://user:password@localhost:5432/mission_control"
}
```

### 3. Database setup
```bash
npx prisma generate
npx prisma db push
```

### 4. Run
```bash
npm run dev   # development (with watch)
npm start     # production
```

---

## 📋 Commands

| Command | Description |
|--------|-------------|
| `/request <game> <link> [comment]` | Submit a new game request |
| `/update-request <game> [version] [link] [comment]` | Request an update |
| `/fix-request <game> <issue> [link]` | Report a broken link |
| `/search <query>` | Search existing requests |
| `/stats` | View request statistics |

---

## 🗂️ Channel Structure

Create these channels in your Discord server:

- `#new-game-requests` — New game submissions
- `#update-requests` — Update requests
- `#fix-requests` — Fix requests
- `#priority` — Live leaderboard (auto-updated)
- `#new-games-added` — Completed games
- `#updates-released` — Completed updates
- `#fixes-done` — Completed fixes

---

## 🔄 Lifecycle

```
NEW → REVIEW → ACCEPTED → IN_PROGRESS → DONE
                                           ↘ REJECTED
```

---

## ⚙️ Admin Controls

Admins can change request status via button interactions on each request card.

---

## 📦 Project Structure

```
mission-control/
├── src/
│   └── index.js          # Main bot file
├── prisma/
│   └── schema.prisma    # Database schema
├── config.json           # Bot configuration
├── package.json
└── MISSION.md           # Full project blueprint
```

---

## 📜 License

ISC — Pawan Shekhawat
