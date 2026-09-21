# Sports match list mobile parity

## Goal
Rebuild the sports match list as a compact exchange-style mobile screen while preserving the live feed, filters, and event navigation.

## Changes
- Replace the large title/card layout with a compact sports header and horizontal sport selector.
- Group matches into clear tournament sections, showing in-play status and event time beside each match.
- Show aligned Back and Lay columns directly in the list, using the same blue/pink exchange colors as the event odds page.
- Keep live runner prices visible when supplied; show stable empty price cells when unavailable instead of stretching the row.
- Make All, In-play, and Upcoming filters compact and keep manual refresh available as an icon control.
- Preserve one-second live updates, fallback-feed behavior, full event links, empty/error states, and desktop usability.
- Add the required social metadata fields for the sports list route.

## Verification
- Check the page at 393×706 for alignment, readability, working filters, links, no horizontal overflow, and no browser errors.
- Open one listed match to confirm navigation still works.
- Confirm the latest preview build succeeds.
