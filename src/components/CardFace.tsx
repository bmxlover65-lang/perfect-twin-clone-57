import { CARD_BACK, CARD_SIZE } from "@/lib/card-assets";
import { CARD_FACE_IMAGES } from "@/lib/card-faces";

/** Normalise a feed card code ("H8__", "h8", "D10", "ST") to "H8" style. */
function normalize(code: string): string {
  const clean = (code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!clean) return "";
  const suit = clean.slice(0, 1);
  let rank = clean.slice(1);
  if (rank === "1" || rank === "01") rank = "A";
  if (rank === "T") rank = "10";
  return `${suit}${rank}`;
}

/** A real playing card image (classic deck artwork), face-down back when hidden. */
export function CardFace({ code }: { code: string }) {
  const c = normalize(code);
  const hidden = !c || c === "0" || c === "1" || (c.length === 1);
  const src = hidden ? CARD_BACK : CARD_FACE_IMAGES[c];
  return (
    <img
      src={src ?? CARD_BACK}
      alt={hidden ? "card" : c}
      className={`${CARD_SIZE} bg-white object-contain`}
      loading="lazy"
    />
  );
}
