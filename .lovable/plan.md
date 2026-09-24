# Sports match page: full Dukex mobile parity

## Goal
Make every sports match screen match Dukex at 393px, while keeping Universal branding outside the match. Casino and API docs remain untouched.

## Changes
1. **Match header and TV behavior**
   - Match Dukex’s compact in-match header, title sizing, spacing, balance/exposure area, back control, and TV icon.
   - Keep Live TV closed by default, open it only from the TV icon, and close it from the same icon without leaving empty space.
   - Show the scoreboard only when the reference and live provider support it; otherwise show Dukex’s unavailable state.

2. **All live market controls**
   - Build tabs from every market currently returned by the feed: All, Popular, Match Odds, Bookmaker, Fancy, over/under, innings/over lines, and any additional live market names.
   - Make every tab filter the correct live rows and preserve live price updates.
   - Keep finished sessions removed, suspended rows blocked, and newly arriving over/fancy markets appearing automatically.

3. **Exact mobile sizing and interactions**
   - Match the 393px reference for market headers, min/max labels, runner columns, Back/Lay cells, text sizes, row heights, colors, suspended overlays, and horizontal tab scrolling.
   - Test every visible tab, TV toggle, Back/Lay/No/Yes price, bet slip controls, cancel, and suspended-state click blocking.

4. **Visual proof**
   - Capture Dukex and our live match at the same 393px viewport and merge them into one comparison image.
   - Verify cricket, soccer, and tennis where live matches are available; retain the existing race follow-up if Dukex still does not expose a race page.

## Constraints
- No casino code, casino styles, casino feeds, or casino behavior changes.
- No sports/casino docs changes and no public API response-shape changes.
- Live prices update as fast as the provider supplies them; no artificial 0.1ms claim.
