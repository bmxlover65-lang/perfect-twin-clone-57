# Universal API — B2B casino/sports platform roadmap

Decisions: operator balance via **callback wallet** (operator's own site balance);
manual result override only for **self-generated games** (Balloon, Dream Catcher,
Lucky 0-9, Heads & Tails, Aviator, Ball by Ball).

## Phase 1 — Betting UI everywhere (in progress)
- [x] Shared wallet + bet book (`src/lib/wallet.ts`)
- [x] Reference-style bet slip: odds/stake steppers, chip grid, Cancel/Place Bet
- [x] Error toasts: "You have Insufficient Balance.", "Do Not Place Bet At The Same Time."
- [x] All casino market boards wrapped in `BetLayer` (games.$gameId)
- [x] Sports event markets (match odds, bookmaker, fancy, sportsbook) betting
- [x] Sports live-rate refresh uses uncached requests and ignores late stale responses
- [x] Sports live-rate failover: provider WebSocket → HTTP polling → last-good snapshot
- [ ] Self-generated games (Balloon, Dream, Lucky 0-9, Coin, Aviator) — verify stake debit + payout credit against the real result

## Phase 2 — Cloud backend (done)
- [x] Lovable Cloud enabled
- [x] Tables: user_roles, operators, api_keys, ip_whitelist, domain_whitelist,
      rounds, bets, transactions, callback_logs (RLS + grants, admin/operator scoped)
- [x] API-key auth (sha256 hash) + IP/domain whitelist + plan-expiry check
      (`src/lib/operator-auth.server.ts`)
- [x] Callback wallet with HMAC signature + callback_logs
      (`src/lib/callback-wallet.server.ts`)
- [x] Public API: POST /api/public/v1/balance, POST /api/public/v1/bet (idempotent + rollback),
      GET /api/public/v1/bets
- [x] Admin server fns: operators, API keys, whitelist, manual result + settlement
      (`src/lib/operator-admin.functions.ts`)

## Phase 3 — Wiring (done)
- [x] Email/password auth (`/auth`) + `_authenticated` gate + first-login "Claim admin"
- [x] Admin console `/console`: operators, keys issue/revoke, IP+domain whitelist,
      manual result declare + settlement, callback wallet test, bet ledger
- [x] Operator panel `/operator`: callback balance fetch, rounds, bets, P/L, callback logs
- [x] Casino bet slip fixed (odds cell parsing + A/B side) — real feed result auto-settles bets
- [ ] Launch URL minting + game session tokens
- [ ] Settle real (non-manual) rounds automatically from the live feed

## Phase 4 — Panels (done)
- [x] Admin panel: operators, keys, whitelist, monthly plan, bet ledger, users & GGR, rejected bets
- [x] Operator panel: own API keys, IP/domain whitelist (read-only), plan + days left,
      per-user activity, bet history, rejected bets, self-service callback URL + secret rotate
- [x] `bet_rejections` table — har failed bet attempt (invalid key, closed round, wallet decline) log hoti hai
- [x] Public API smoke-tested: balance / bet (idempotent) / bets, invalid key + wallet decline paths

## Phase 5 — Original table parity (in progress)
- [ ] Compare all 21 casino games against universeapi.shop at mobile width
- [x] Ball by Ball: four-minute mobile reference audit; matched 20-second timer, live rate cadence, 64px boxes, shine, transparent locked state, cricket-ball result, disclaimer and circular history
- [x] Ball by Ball: fix live bet placement after the reference-style bet-slip update
- [x] Ball by Ball: match the supplied 393px screenshot's plate divider, header icons, spacing and colors
- [x] Heads & Tails: full 393px reference parity for stage, timer, shine, markets, locks, round/result and recent results
- [x] Remove white bottom gap in embedded game pages; Balloon artwork fills the available frame height
- [x] Match the shared 393px mobile header height, 16px page gutters, title scale, live-TV width, and compact table scaling
- [ ] Verify video area, timer, round ID, live cards and result banner per table
- [ ] Match every game's market names, order, layout, odds/lock states and min/max text
- [ ] Match recent-result labels/colors and table-specific result rules
- [ ] Re-test every table at mobile and desktop widths with no runtime errors

## Phase 6 — Pending fixes (user list, Sep 5)
- [x] Dream Catcher + Lucky 0-9: chips 100…100k, "U" in wheel centre, bigger Dream wheel, own spin sound
- [~] Baccarat + Muflis TP: chips done; card display pending
- [~] 20-20 TP + Lucky 7: Recent Result attached + Tie shown as "T"; card display pending
- [ ] 1Day TP + DTL: card display; Recent Result under last market; DTL rate box
- [ ] 1 Day Dragon Tiger: rate box + video card display
- [ ] Joker TP, 20-20 DT, Andar Bahar, 20-20 Poker, 32 Cards: cards + Recent Result under last market
- [ ] Card Race: market box + Recent Result placement
- [ ] Amar Akbar Anthony: rate box (Odd/Even, Colour, Under/Over) + cards
- [~] VIMAAN: spelling + lobby order done; flying/result pending
- [ ] Balloon: visuals, recent result, flying like original

## Phase 7 — Royal444 full casino structure parity (pending reference access)
- [ ] Audit the reference casino lobby and every casino game page at mobile width
- [x] Match shared casino market headers, blue bodies, rate boxes and divider colors to the supplied mobile reference
- [x] Show placed-bet liability and profit below the market odds boxes like the supplied reference
- [ ] Match shared casino navigation, game shell and spacing
- [ ] Apply the same structure across all casino pages on universeapi.store
- [ ] Verify every casino page at mobile and desktop widths

- [x] Win celebration confetti on all tables (loss = no celebration)
- [x] Strict winner matching prevents side-market losses from triggering payout/confetti
- [x] Casino suspension is stable per round and clears only when the next round starts
