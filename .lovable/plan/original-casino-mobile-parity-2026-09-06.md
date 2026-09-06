# Original Casino Mobile Parity

## Goal
Make every casino game match the original universeapi.shop table at a 393px mobile width, including exact visible text, colors, shapes, sizes, spacing, cards, markets, locks, and result states. Each game will be compared and completed individually rather than forcing different tables into one shared layout.

## Work order

1. **Shared live-TV area**
   - Match the video frame height, background, round ID, timer, card placement, card size, spacing, face-down state, and result announcement.
   - Keep every card fully visible and centered on mobile and desktop.
   - Remove all white gaps above, between, and below the video, markets, and result strip in embedded mobile mode.

2. **Live card tables, one by one**
   - 20-20 Teen Patti, Lucky 7, 1 Day Teen Patti, Joker Teen Patti
   - 20-20 Dragon Tiger, Baccarat, Andar Bahar, 32 Cards
   - Poker, DTL, 1 Day Dragon Tiger, Muflis Teen Patti
   - Card Race, Amar Akbar Anthony, Dragon Tiger

3. **Original games, one by one**
   - Ball by Ball, Lucky 0 to 9, Dream Catcher
   - Heads & Tails, Viman, Balloon

4. **Per-table checks**
   - Exact title, round details, hand names, and dealt-card grouping
   - Correct market titles, spelling, runner order, odds boxes, locks, limits, colors, borders, dividers, corner shape, and row height
   - Correct result announcement and recent-result chip
   - Correct chips, controls, wheel/coin/balloon artwork, and table-specific animations
   - No clipped, overlapping, or broken content on a 393px mobile screen

5. **Final verification**
   - Open every game in an automated 393px mobile pass, capture the rendered table, and record page/runtime failures.
   - Recheck representative desktop layouts and confirm the latest build is clean.

## Technical approach
- Keep the real live feed as the source for cards, markets, odds, status, and results.
- Use dedicated table renderers where the original has a unique board; share only genuinely identical layouts.
- Normalize irregular feed card/result shapes before rendering so one table cannot break another.
- Use the existing 52-card artwork for every visible card face and one shared card size contract.
- Keep operator wallet, settlement, API, and sports behavior unchanged while doing this visual parity pass.

## Completion rule
A table is complete only after its original and local mobile views have been compared and its video cards, betting board, and result strip have been verified.