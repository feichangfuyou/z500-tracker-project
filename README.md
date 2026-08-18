# Crosscheck — unofficial launch ledger

A third-party tracker for launches on ansem.io. Not built or endorsed by ansem.io.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Moderation: [/mod](http://localhost:3000/mod) (local key `dev-mod`, override with `MOD_KEY`).

## Launch env

| Variable | Required in prod | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Hosted board (Supabase project `crosscheck`) |
| `SUPABASE_ANON_KEY` | Yes | Calls `crosscheck_dump` / `crosscheck_save` |
| `STORE_SECRET` | Yes | Shared secret for those RPCs |
| `MOD_KEY` | Yes | `/mod` login; local default is `dev-mod` |
| `SOLANA_RPC` | Strongly recommended | Paid Helius/QuickNode URL. Public RPCs are failover only. |
| `CRON_SECRET` | Yes in prod | Bearer for `/api/cron/scan`. Vercel injects this on cron invocations. Local default is `dev-cron`. |
| `HELIUS_API_KEY` | Optional | Used if `SOLANA_RPC` is not a Helius URL with `?api-key=` |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Optional | Tape alerts when the tab is closed |
| `DISCORD_WEBHOOK_URL` | Optional | Same tape, Discord |

## What's built

- **Shared public board** — SQLite locally, Supabase `store_blob` when the env vars above are set.
- **Discovery** — ansem.io `/api/coins`, then cached snapshot, then pump.fun, then DexScreener.
- **Onchain burns** — Helius `type=BURN` indexer with resume (head + older pages). RPC 12/80 pages is failover when no Helius key.
- **Wallet provenance** — mint create-tx (pump user / mint authority) first, pump.fun creator API second.
- **Same-slot bundles** — create-window parse plus RugCheck sniper/insider flags.
- **Boosts** — live ansem.io `/api/boosts` (expired dropped). Shown on the board and folded into score.
- **Dex overlay** — circulating mcap / volume / liquidity from DexScreener, batched and cached. Listed mcap is fallback.
- **z500 column** — official-like order (listed airdrop mcap + boosts) vs Crosscheck rank (adds verified burns).
- **Score proxy** — airdropped-supply mcap + burn value + active boosts. Not the official index formula.
- **Watchlist** — session cookie plus optional wallet key; merges with this browser's list.
- **Coin dossier** — holders, create-tx, Dex chart, share card, OG image, embed iframe.
- **Daily index** — top 25 snapshot per UTC day (`/index`).
- **Known wallets** — launch wallets grouped on `/wallets`, serial deployer flags at 5+ coins.
- **Airdrop P&L** — in wallet vs still-claimable vs claimed-then-sold. Claim CTAs go to ansem.io.
- **Closed-tab alerts** — Telegram/Discord from cron. `/mod` shows armed channels and can send a test.
- **Public JSON** — `/api/public/board`, `/api/public/coin/[mint]`, `/api/public/index` (CORS `*`).
- **Partner embeds** — `/partner` install page; `/embed/[mint]?v=chip|burn|flags|delta|card`.
- **CI** — `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run test:e2e` on every push.
- **License** — MIT.

## Privacy

Session cookie `tracker_sid` plus an optional watch wallet. Details: `/privacy`.

## Data sources

| Source | Used for | Confidence |
|---|---|---|
| ansem.io public APIs | discovery, listed mcap, airdrop totals, $ANSEM ref | High for what it publishes |
| DexScreener | circulating mcap / FDV, discovery fallback | High — live, direct |
| pump.fun coin API | discovery fallback, creator hint | Medium — public, unofficial |
| Solana RPC / Helius | onchain $ANSEM burns, mint create-tx, holders | High for the scanned window |
| RugCheck | holder concentration, insider/sniper labels | Medium — third-party |
| Score formula | ranking | Invented proxy |

## Files

- `components/tracker.tsx` — board UI
- `lib/` — score, discovery, DexScreener, Solana burns, store
- `app/api/` — board, community CRUD, verify, holders, provenance, watch, public, mod
- `z500-tracker.jsx` — original single-file artifact (reference only)
