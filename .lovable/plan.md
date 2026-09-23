# Casino Live TV Player Upgrade

## Goal
Casino games ke existing live streams ko uploaded player jaisa polished, mobile-first experience dena, betting boards aur feed logic ko badle bina.

## Changes
- Reusable Live TV player frame banega: black 16:9 video area, branded loading state, connection/retry message, mute and fullscreen controls.
- Existing verified casino stream URLs isi frame ke andar chalenge; stream source ya game/result feed nahi badlega.
- Slow/error load par automatic retry control aur clear status dikhaya jayega.
- Har table game par same player treatment lagega, aur 393px mobile par video poora visible rahega.
- Uploaded proprietary scripts ko direct copy nahi karenge; unke visible behavior aur layout ko project-native React/CSS me recreate karenge.

## Verification
- Lucky 7, Baccarat aur 20-20 Teen Patti par stream load, retry, fullscreen/mute controls check karenge.
- 393px viewport par crop, overlap, horizontal overflow aur console errors verify karenge.
- Final build status check karenge.
