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
- [x] Casino bet panel: open immediately below the clicked rate row on every table
- [x] Ball by Ball: match the supplied 393px screenshot's plate divider, header icons, spacing and colors
- [x] Heads & Tails: full 393px reference parity for stage, timer, shine, markets, locks, round/result and recent results
- [x] Heads & Tails: 20-second round display with supplied Heads/Tails coin and betting images; round-matched winner result
- [x] Heads & Tails: stage winner and first Recent Result always use the same exact round result
- [x] Ball by Ball + Heads & Tails: reference row gaps, dark locked plates, and inline bet panel that preserves lower rows
- [x] Remove white bottom gap in embedded game pages; Balloon artwork fills the available frame height
- [x] Match the shared 393px mobile header height, 16px page gutters, title scale, live-TV width, and compact table scaling
- [ ] Verify video area, timer, round ID, live cards and result banner per table
- [ ] Match every game's market names, order, layout, odds/lock states and min/max text
- [ ] Match recent-result labels/colors and table-specific result rules
- [ ] Re-test every table at mobile and desktop widths with no runtime errors

## Phase 6 — Pending fixes (user list, Sep 5)
- [x] Dream Catcher + Lucky 0-9: chips 100…100k, "U" in wheel centre, bigger Dream wheel, own spin sound
- [x] Baccarat: mobile reference stage/cards, rounded betting board, per-area locks, chip rail and Recent Result
- [~] Muflis TP: chips done; card display pending
- [~] 20-20 TP + Lucky 7: Recent Result attached + Tie shown as "T"; card display pending
- [x] Lucky 7: match supplied Lucky Card and Card Suit compact 100×37 plates, card art, typography and light-blue surfaces
- [x] 1Day TP: mobile reference stage ratio, live card overlay, compact Winner board, full suspend veil and real Recent Result strip
- [x] 1Day TP: match the Royal suspended veil placement, opacity, text size and full row visibility from the side-by-side reference
- [x] 1Day TP: match supplied white PLAYER rows and dark label/odds text
- [x] Joker TP: match Royal mobile font weight, light row surface, price-column width, row height and result-strip proportions
- [x] Joker TP: match supplied white PLAYER row surface and dark bold serif label text
- [x] 20-20 Dragon Tiger: match Royal mobile board height, light surface, plate sizing, typography and compact result strip
- [ ] DTL: card display; Recent Result under last market; DTL rate box
- [ ] 1 Day Dragon Tiger: rate box + video card display
- [x] Joker TP: mobile reference stage ratio, Joker/player cards, compact Winner board and Recent Result strip
- [x] 20-20 DT: mobile reference stage, Dragon/Tiger cards, centred Tie market and result colors
- [x] Andar Bahar: Royal mobile layout, live/suspended plates, Odd/Even, suits, rank cards and Recent Result
- [x] Lucky 7 Lucky Card: full-width two-column plates with reference row spacing and compact card/rate typography
- [x] Lucky 7 Lucky Card: supplied 100×38 blue boxes with rank above, bordered mini-card, rate and full amount
- [x] 20-20 Poker: Royal mobile Player tabs, curved gold price panels, per-market suspended overlays and Recent Result
- [x] 32 Cards: Royal mobile Winner, Card Color, Card Total and Lucky Number tables with section-scoped suspended overlays
- [ ] Card Race: market box + Recent Result placement
- [ ] Amar Akbar Anthony: rate box (Odd/Even, Colour, Under/Over) + cards
- [x] VIMAAN: match supplied mobile history strip, radial flying graph, waiting/plane state, flew-away result and compact All Bets header
- [x] Balloon: Royal-style mobile scene, balloon scale, live/waiting result states, compact controls, stakes and HEAT buttons
- [x] Balloon: transparent scenic betting controls and masked live-player activity below the avatar
- [x] Balloon: remove the white strip below betting controls and continue the scene to the frame edge
- [x] Balloon: match supplied mobile result strip, two-row live activity, full scene fit, and compact two-panel betting controls
- [x] Balloon: remove artificial white sweep, enforce 100 minimum, one bet per panel per round, and reference Auto/control alignment
- [x] Balloon: move supplied cloud-air, small plane and stars into the Balloon scene with subtle occasional motion; remove them from VIMAAN
- [x] Balloon: reference flight path — small plane crosses left-to-right on a gentle curve with a drawn air trail; clouds and stars follow the flying phase
- [x] Balloon: 8-second wait, plane kept ahead of its trail through the right edge, vertical cloud/star drift, disabled HEAT label retained, aligned Auto controls and full-width scenic dock
- [x] Balloon: align the plane's rear with the live trail endpoint and split the long cloud strip into compact cloud clusters
- [x] Balloon: match the supplied real betting dock — navy stake pills, compact Edit/Clear/Min/Max column, aligned Auto switches and darker HEAT buttons
- [x] Balloon: extend and scale the scenery through the full mobile frame so no white strip appears below the betting dock
- [x] Balloon: match the supplied waiting reference with a top-positioned balloon, compact one-line label, green 8-second ring and undistorted scenery
- [x] Balloon: use the matching mountain scene during countdown, enlarge the waiting balloon and hide the burner flame until flight
- [x] Balloon: attach the plane image itself to the exact animated trail path so the line stays connected behind it
- [x] Balloon: reduce and lower the waiting balloon, slow the descending scenery, keep compact clouds at the top, delay the plane entrance, and lighten the control backdrop
- [x] Balloon: match the supplied betting panel's exact 327px proportions, Auto positions, stake/action spacing and HEAT sizing

## Phase 7 — Royal444 full casino structure parity (pending reference access)
- [ ] Audit the reference casino lobby and every casino game page at mobile width only
- [x] Match shared casino market headers, blue bodies, rate boxes and divider colors to the supplied mobile reference
- [x] Show placed-bet liability and profit below the market odds boxes like the supplied reference
- [x] Match the supplied table screenshots' shared black stage branding and three-second result callout
- [x] Re-audit the six supplied game IDs top-to-bottom at 393px with no overflow or runtime errors
- [x] Keep fallback branding off the live video and prevent compact Back/Lay headers from truncating on mobile
- [ ] Match shared casino navigation, game shell and spacing
- [ ] Apply the same structure across all casino pages on universeapi.store
- [ ] Verify every casino page at mobile width; mobile is the required parity target

- [x] Win celebration confetti on all tables (loss = no celebration)
- [x] Strict winner matching prevents side-market losses from triggering payout/confetti
- [x] Casino suspension is stable per round and clears only when the next round starts
- [x] Heads & Tails: chip-first betting — chip select karo, phir Heads/Tails par ek click = bet (no bet slip)
- [x] Ball by Ball: locked plates par chhota lock, rate/label dikhte rahein
