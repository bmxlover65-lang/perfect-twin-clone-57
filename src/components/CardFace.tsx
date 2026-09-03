import { CARD_BACK, CARD_SIZE } from "@/lib/card-assets";

const GLYPH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

/** Pip coordinates as [colIndex 1..3, rowFraction 0..1] for each rank. */
const PIPS: Record<string, [number, number][]> = {
  A: [[2, 0.5]],
  "2": [
    [2, 0.06],
    [2, 0.94],
  ],
  "3": [
    [2, 0.06],
    [2, 0.5],
    [2, 0.94],
  ],
  "4": [
    [1, 0.06],
    [3, 0.06],
    [1, 0.94],
    [3, 0.94],
  ],
  "5": [
    [1, 0.06],
    [3, 0.06],
    [2, 0.5],
    [1, 0.94],
    [3, 0.94],
  ],
  "6": [
    [1, 0.06],
    [3, 0.06],
    [1, 0.5],
    [3, 0.5],
    [1, 0.94],
    [3, 0.94],
  ],
  "7": [
    [1, 0.06],
    [3, 0.06],
    [2, 0.28],
    [1, 0.5],
    [3, 0.5],
    [1, 0.94],
    [3, 0.94],
  ],
  "8": [
    [1, 0.06],
    [3, 0.06],
    [2, 0.28],
    [1, 0.5],
    [3, 0.5],
    [2, 0.72],
    [1, 0.94],
    [3, 0.94],
  ],
  "9": [
    [1, 0.06],
    [3, 0.06],
    [1, 0.36],
    [3, 0.36],
    [2, 0.5],
    [1, 0.64],
    [3, 0.64],
    [1, 0.94],
    [3, 0.94],
  ],
  "10": [
    [1, 0.06],
    [3, 0.06],
    [2, 0.2],
    [1, 0.36],
    [3, 0.36],
    [1, 0.64],
    [3, 0.64],
    [2, 0.8],
    [1, 0.94],
    [3, 0.94],
  ],
};

const COL_X: Record<number, string> = { 1: "26%", 2: "50%", 3: "74%" };

/** A real-looking playing card face: corner index + pip layout (or court letter). */
export function CardFace({ code }: { code: string }) {
  const clean = (code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const hidden = !clean || clean === "0" || clean === "1";
  if (hidden) {
    return (
      <img src={CARD_BACK} alt="card" className={`${CARD_SIZE} bg-white object-fill`} loading="lazy" />
    );
  }
  const suit = clean.slice(0, 1);
  let rank = clean.slice(1);
  if (rank === "1" || rank === "01") rank = "A";
  if (rank === "T") rank = "10";
  const glyph = GLYPH[suit] ?? "?";
  const red = suit === "H" || suit === "D";
  const pips = PIPS[rank];
  const color = red ? "text-red-600" : "text-black";

  return (
    <span
      className={`${CARD_SIZE} relative inline-block overflow-hidden bg-white ${color}`}
      aria-label={`${rank} ${glyph}`}
    >
      <span className="absolute left-[2px] top-[1px] flex flex-col items-center leading-none">
        <span className="text-[0.52rem] font-bold">{rank}</span>
        <span className="text-[0.5rem] leading-none">{glyph}</span>
      </span>
      {pips ? (
        <span className="absolute inset-y-[6px] left-[11px] right-[2px] block">
          {pips.map(([col, y], i) => (
            <span
              key={i}
              className="absolute text-[0.5rem] leading-none"
              style={{
                left: COL_X[col],
                top: `${y * 100}%`,
                transform: `translate(-50%, -50%) ${y > 0.5 && col !== 2 ? "rotate(180deg)" : ""}`,
              }}
            >
              {glyph}
            </span>
          ))}
        </span>
      ) : (
        <span className="absolute inset-y-0 left-[11px] right-0 flex items-center justify-center text-[0.95rem] font-bold">
          {rank}
        </span>
      )}
    </span>
  );
}
