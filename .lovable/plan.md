# Sports A-to-Z parity

## Goal
Make every sports match page use one dynamic Dukex-style experience, so new and removed matches work without per-match UI edits.

## Build
- Add a sport-specific visual banner below the match header for pre-match events, with the live event name, status, start time, and countdown over the image.
- Drive the banner, TV, scoreboard, tabs, market boards, runner names, min/max, suspension overlays, and update timing from each event's live feed.
- Keep the existing Universal header only and preserve the 393px mobile layout without horizontal overflow.
- Cover cricket, soccer, tennis, horse racing, greyhound racing, and unknown sports through reusable fallbacks.
- Keep market-specific bet labels and result matching isolated so identical runner names in different markets cannot settle each other.
- Verify Back/Lay and Yes/No clicks, suspended blocking, live rate refreshes, event switching, and result/void behavior.

## Visual direction
Use the compact Dukex reference proportions: a shallow photographic match banner, dark teal title strips, dense white boards, blue Back, pink Lay, and exact mobile-first hierarchy.

## Constraints
- Do not change casino code, styles, feeds, or behavior.
- Do not change sports or casino API documentation or public response shapes.
- Fancy/session bets remain void/refund-only when the upstream feed provides no final winner.

## Verification
Test representative cricket, soccer, tennis, and racing pages at 393×852, including TV closed/open, market tabs, an active bet slip, suspended markets, and no overflow. Produce one final reference-versus-Universal comparison image.
