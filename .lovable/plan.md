# Universal API — Live Casino Clone

Ek apna full clone banayenge universeapi.shop jaisa: same layout, same game names, same look — par saara data apna (built-in demo/simulated live data), kisi bahar ke API par depend nahi.

## Pages

1. **Lobby (/)** — dark navbar (RI logo + "Universal API", nav: Games, Sports, Casino Docs, Sports Docs, theme toggle), grey lobby card with "UNIVERSAL API" eyebrow, "Universe Live" heading, subtitle, "20 games" + "Universe Live" pills, aur 4-column game grid (portrait tiles, hover overlay with game name + yellow LIVE badge).
   - Wahi 20 games: Ball by Ball, 20-20 Teenpatti, Lucky 7, 1 Day Teen Patti, Joker Teen Patti, 20-20 Dragon Tiger, Baccarat, Andar Bahar, 32 Cards, Poker, DTL, 1 Day Dragon Tiger, Muflis Teen Patti, Card Race, Amar Akbar Anthony, Dragon Tiger, Lucky 0 to 9, Dream Catcher, Heads & Tails, Balloon — same game IDs (99.0010 etc.).

2. **Game page (/games/$gameId)** — "← Back to lobby", LIVE · UNIVERSE LIVE eyebrow, game title, green "Live" pill, phir:
   - Black stream panel: RID number, Player A / Player B card rows (playing-card graphics, hidden-card back), stream placeholder area.
   - Odds boards: WINNER, PAIR (DUBBLE) 1:4, FLUSH (COLOR) 1:8, STRAIGHT (ROWN) 1:14, STRAIGHT FLUSH 1:40, TRIO 1:75, PUTLA 1/2/3, QUEEN & KING, JACK & QUEEN — har row me Min/Max, back odds + volume, aur SUSPENDED overlay.
   - "Recent Result" strip (A / B round chips) + result modal with winner/loser trophy icons.
   - Game type ke hisaab se board layout: teenpatti-style, dragon tiger, baccarat, andar bahar, lucky 7/0-9, coin/wheel games.

3. **Sports (/sports)** — sports markets list (cricket/football/tennis) same visual language me, live odds cards.

4. **Casino Docs (/casino-docs)** aur **Sports Docs (/sports-docs)** — docs layout: left sidebar sections, endpoint list, sample request/response JSON blocks, copy-friendly code styling.

## Live behaviour (apna, bina external API)

- Ek client-side "live engine": har game ka round tick karta hai (betting open → suspended → result → naya round), odds thode-thode fluctuate hote hain, cards deal hote hain, recent results list update hoti hai, RID badalta hai.
- Sab kuch deterministic seeded logic se, taki page refresh par bhi sensible lage. Baad me chaho to isi jagah apna real API plug ho jayega (ek hi data layer file).

## Design

- Light/dark dono themes with toggle (site jaisa): dark navbar, `#ededed` lobby surface, white cards, black odds headers, blue-grey odds panels, yellow LIVE badge, green live pill.
- Game thumbnails aur playing cards: khud generate kiye gaye assets (external site ke images par depend nahi), portrait 16:23 ratio, same grid feel.
- Semantic design tokens `src/styles.css` me, hardcoded colors nahi.

## Technical

- TanStack Start routes: `index.tsx`, `games.$gameId.tsx`, `sports.tsx`, `casino-docs.tsx`, `sports-docs.tsx`; shared navbar + theme toggle `__root.tsx` me.
- `src/data/games.ts` — 20 games ki catalog (id, name, slug, type, thumbnail).
- `src/lib/live-engine.ts` — round/odds/cards simulation hook (`useLiveGame(gameId)`), pure client tick with SSR-safe initial state.
- Components: `GameCard`, `OddsBoard`, `OddsRow`, `CardHand`, `RecentResults`, `ResultModal`, `DocsLayout`.
- Trophy icons: uploaded `trophy-icons.css` wali approach (inline SVG mask, koi Font Awesome CDN nahi) as a local component.
- Har route ka apna `head()` metadata (title/description/og).

Backend ki abhi zarurat nahi — sab frontend + simulated data. Agar baad me real bets/users chahiye to Lovable Cloud add kar sakte hain.
