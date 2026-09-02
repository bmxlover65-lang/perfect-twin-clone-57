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
- [ ] Self-generated games (Balloon, Dream, Lucky 0-9, Coin, Aviator) — verify stake debit + payout credit against the real result

## Phase 2 — Cloud backend
- [ ] Enable Lovable Cloud
- [ ] Tables: operators, api_keys, ip_whitelist, domain_whitelist, subscriptions,
      rounds, results, bets, transactions, callback_logs, user_roles
- [ ] RLS + grants; operator-scoped policies

## Phase 3 — Operator API (`/api/public/*`)
- [ ] API-key auth + IP/domain whitelist + subscription expiry check
- [ ] Launch URL minting, bet placement, settlement
- [ ] Callback wallet: debit/credit against operator's site balance, signed + retried

## Phase 4 — Panels
- [ ] Admin panel: operators, keys, whitelist, monthly plan, bet ledger, manual result override
- [ ] Operator panel: own keys, whitelist, callback URL, bet history, P/L
