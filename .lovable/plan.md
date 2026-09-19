# Balloon Real-Game Parity

## Goal
Mobile Balloon screen को supplied real-game reference जैसा बनाना, खासकर betting area, flying balloon size, और round timing।

## Changes
- Balloon का waiting और flying size/position reference के बराबर छोटा और stable रखेंगे; multiplier balloon के centre में रहेगा।
- Betting dock को reference proportions में बनाएँगे: two Auto controls, 4×2 stake buttons, Edits/Clear/Min/Max column, और दो equal HEAT/BETS CLOSED buttons।
- Control height, gaps, borders, colors, shadows और bottom spacing supplied screenshots से match करेंगे।
- Round phase को incoming live round ID, status, countdown और multiplier से synchronize करेंगे। New round पर flight शुरू होगी; official result/status पर उसी multiplier पर burst/result होगा।
- Feed उपलब्ध रहते local random crash/independent timer use नहीं होगा; fallback केवल feed unavailable होने पर चलेगा।
- 393px mobile viewport पर waiting, flying, closed/result और controls verify करेंगे; runtime/build errors भी check होंगे।

## Scope
केवल Balloon game बदलेगा; दूसरे casino games और wallet rules unchanged रहेंगे।
