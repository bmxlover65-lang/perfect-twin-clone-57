import { CARD_BACK, CARD_SIZE, cardImage } from "@/lib/card-assets";

/** Normalise a feed card code ("H8__", "h8", "D10", "ST") to "H8" style. */
function normalize(code: unknown): string {
  const clean = String(code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!clean) return "";
  const suit = clean.slice(0, 1);
  let rank = clean.slice(1);
  if (rank === "1" || rank === "01") rank = "A";
  if (rank === "T") rank = "10";
  return `${suit}${rank}`;
}

const SUIT_GLYPH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

/**
 * Live-table card: shows the real printed card artwork when we have it,
 * otherwise a white tile with the rank above and the suit symbol below.
 * Face-down cards keep the printed card back.
 */
export function CardFace({ code }: { code: string }) {
  const c = normalize(code);
  const suit = c.slice(0, 1);
  const rank = c.slice(1);
  const glyph = SUIT_GLYPH[suit];
  const hidden = !c || !glyph || !rank;

  if (hidden) {
    return (
      <img
        src={CARD_BACK}
        alt="card"
        className={`${CARD_SIZE} bg-white object-contain`}
        loading="lazy"
      />
    );
  }

  const img = cardImage(c);
  if (img) {
    return (
      <img
        src={img}
        alt={c}
        className={`${CARD_SIZE} bg-white object-cover`}
        loading="lazy"
      />
    );
  }

  const red = suit === "H" || suit === "D";
  const tone = red ? "text-card-red" : "text-card-black";

  return (
    <span
      aria-label={c}
      className={`${CARD_SIZE} flex flex-col items-center justify-center bg-white leading-none ${tone}`}
    >
      <span className={`flex h-1/2 w-full items-center justify-center border-b ${red ? "border-card-red" : "border-card-black"} text-[0.62rem] font-extrabold sm:text-[0.8rem]`}>
        {rank}
      </span>
      <span className="flex h-1/2 w-full items-center justify-center text-[0.62rem] font-extrabold sm:text-[0.8rem]">
        {glyph}
      </span>
    </span>
  );
}

