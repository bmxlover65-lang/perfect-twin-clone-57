import { CARD_BACK, CARD_SIZE } from "@/lib/card-assets";

const GLYPH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

/** Pip coordinates as [x%, y%] inside the pip area for each rank. */
const PIPS: Record<string, [number, number][]> = {
  A: [[50, 50]],
  "2": [
    [50, 12],
    [50, 88],
  ],
  "3": [
    [50, 12],
    [50, 50],
    [50, 88],
  ],
  "4": [
    [26, 12],
    [74, 12],
    [26, 88],
    [74, 88],
  ],
  "5": [
    [26, 12],
    [74, 12],
    [50, 50],
    [26, 88],
    [74, 88],
  ],
  "6": [
    [26, 12],
    [74, 12],
    [26, 50],
    [74, 50],
    [26, 88],
    [74, 88],
  ],
  "7": [
    [26, 12],
    [74, 12],
    [50, 31],
    [26, 50],
    [74, 50],
    [26, 88],
    [74, 88],
  ],
  "8": [
    [26, 12],
    [74, 12],
    [50, 31],
    [26, 50],
    [74, 50],
    [50, 69],
    [26, 88],
    [74, 88],
  ],
  "9": [
    [26, 12],
    [74, 12],
    [26, 37],
    [74, 37],
    [50, 50],
    [26, 63],
    [74, 63],
    [26, 88],
    [74, 88],
  ],
  "10": [
    [26, 12],
    [74, 12],
    [50, 25],
    [26, 37],
    [74, 37],
    [26, 63],
    [74, 63],
    [50, 75],
    [26, 88],
    [74, 88],
  ],
};

const W = 39;
const H = 46;

/** A real-looking playing card face: corner index + pip layout (or court block). */
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
  const fill = red ? "#D32029" : "#111111";
  const pips = PIPS[rank];

  // Pip field inside the card (leaves room for both corner indices).
  const px = 12;
  const py = 7;
  const pw = W - px - 4;
  const ph = H - py * 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`${CARD_SIZE} bg-white`}
      role="img"
      aria-label={`${rank} ${glyph}`}
    >
      <rect x="0" y="0" width={W} height={H} rx="4" fill="#ffffff" stroke="#d7d7d7" strokeWidth="0.6" />

      {/* top-left index */}
      <text
        x="3.2"
        y="9.5"
        fill={fill}
        fontSize={rank === "10" ? 7 : 8.5}
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        {rank}
      </text>
      <text x="3.2" y="16.5" fill={fill} fontSize="7" fontFamily="Arial, Helvetica, sans-serif">
        {glyph}
      </text>

      {pips ? (
        pips.map(([x, y], i) => (
          <text
            key={i}
            x={px + (x / 100) * pw}
            y={py + (y / 100) * ph}
            fill={fill}
            fontSize="7.5"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            {glyph}
          </text>
        ))
      ) : (
        <>
          <rect
            x={px + 1}
            y={py + 3}
            width={pw - 2}
            height={ph - 6}
            rx="1.6"
            fill="none"
            stroke={fill}
            strokeWidth="0.7"
          />
          <text
            x={px + pw / 2}
            y={py + ph / 2}
            fill={fill}
            fontSize="12"
            fontWeight="700"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            {rank}
          </text>
        </>
      )}
    </svg>
  );
}
