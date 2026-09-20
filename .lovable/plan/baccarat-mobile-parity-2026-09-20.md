# Baccarat mobile parity

## Goal
Match the Baccarat screen to the three supplied Royal references at mobile width, without changing its live data or betting rules.

## Changes
- Rebuild the main betting area with the reference proportions: rounded Player/Banker split, centered circular Tie plate, and separate Player Pair/Banker Pair row.
- Remove the visible Min/Max line and abbreviated amounts; show full live values such as `500000`.
- Add the subtle `0%` label and match the blue, red, green, light-gray surface, borders, typography, spacing, and shadows.
- Match the horizontal chip rail: larger chips, reference labels (`1k`, `5k`, `10k`, `25k`, `50k`, `100k`, `200k`, `500k`), white center values, and no dark backing strip.
- Match open and locked states. When closed, dim each betting area and show a centered lock without replacing the whole board.
- Keep Player/Banker card overlays and timer aligned to the supplied mobile proportions.
- Match the compact black Recent Result strip with blue Player, red Banker, and green Tie circles.

## Validation
- Test at 393px mobile width using representative open and locked feed states.
- Confirm every betting area remains clickable only while open, no horizontal page overflow, no console errors, and a clean build.
