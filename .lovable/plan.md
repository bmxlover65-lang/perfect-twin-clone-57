# Sports: Dukex parity, live TV/scoreboard, results and settlement check

## Goal
Keep the sports list branded as Universal outside. When a user opens a match, the inside screen looks and works the same as Dukex for Cricket, Soccer, Tennis, Horse Racing and Greyhound Racing. Casino stays locked and untouched. The API docs stay exactly as they are.

## Steps
1. **Side-by-side audit (mobile 393px)**
   - Log in to Dukex with the existing test account. Open one live match per sport there and in our app.
   - Put the two screenshots side by side for each sport: header, live TV, scoreboard, Match Odds, Bookmaker, Fancy/Session, other markets, race runners, suspended states and bet slip.
   - Write down every difference.
2. **Match page UI parity**
   - Restyle the inside match page to Dukex: market headers, Back/Lay colors and sizes, min/max, suspended overlays, fancy rows, runner P/L lines and bet slip layout.
   - Add a race layout (runner list with numbers, jockey names and silks where the feed has them) so horse and greyhound races look like Dukex.
   - Keep the outside list and branding as Universal.
3. **Live TV and scoreboard**
   - Check that live TV plays for each sport and that the scoreboard loads. Where the feed has no scoreboard, fall back to the right provider.
   - Make odds and scoreboard updates as fast as the feed allows. The live feed can only update about 3 times a second, so "0.1 ms" is not possible. The target is to show every change in the same instant Dukex does.
4. **Bets, results and winnings**
   - Place small test bets on a live market for each sport, in both apps.
   - Confirm the P/L shows under each runner, the market suspends at the right time, the result comes from the real feed, winnings are paid correctly and losing bets are deducted.
   - Fix any settlement gaps: fancy/session line results, bookmaker, match odds and race winners, including refunds for voided markets.
5. **Final proof**
   - Make one combined comparison image per sport (Dukex vs ours): before the bet, after the bet, and after the result.

## Constraints
- No changes to casino code, styles, feeds or behavior.
- No changes to the casino or sports docs pages, or to the public API responses the docs describe.

## Technical details
- Files in scope: `src/routes/sports.$sportId.$eventId.tsx`, `src/components/LiveTv.tsx`, `src/components/Scoreboard.tsx`, sports settlement in `src/lib/wallet.ts` (sports paths only), and the sports feed helpers (`aura/ori/ex247/skyfair.server.ts`, `feed-merge.ts`).
- Polling moves toward about 300 ms with one request in flight at a time, reusing the pattern already used for casino.
- API routes under `/api/public/v1/sports*` stay shape-compatible, so the docs keep working unchanged.
