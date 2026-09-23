# Match every casino board on mobile

## Goal
Make each casino game board match the supplied Dukex mobile references at 393px, including market order, plate sizes, typography, colors, rate/volume display, and suspend behavior.

## Work
1. Inventory every casino game and map it to its current board renderer and Dukex reference layout.
2. Standardize shared mobile primitives: market headers, Min/Max rows, back/lay plates, card rows, info controls, and the translucent red `SUSPEND` cover.
3. Update each custom board one by one, starting with Amar Akbar Anthony, Dragon Tiger, Lucky 7, and Baccarat, then the remaining casino tables.
4. Preserve the existing live feed and betting behavior while correcting only presentation and lock-state rendering.
5. Verify every casino route at 393px: full vertical scroll, no horizontal overflow, clickable open rates, correct disabled suspended rates, and no text overlap.

## Technical details
- Use the supplied screenshots and measurable Dukex mobile DOM/CSS as references only; do not embed screenshots.
- Keep each market’s suspend state independent, with one semi-transparent veil and centered `SUSPEND` label per locked market.
- Reuse shared board components where layouts genuinely match; keep table-specific structures where they differ.
- Run the existing type check, inspect build diagnostics, and perform automated mobile browser screenshots for the complete game list.
