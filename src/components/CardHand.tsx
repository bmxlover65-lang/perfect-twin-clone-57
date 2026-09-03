import type { PlayingCard } from "@/lib/live-engine";
import { CARD_BACK, CARD_SIZE } from "@/lib/card-assets";

const SUIT_GLYPH: Record<PlayingCard["suit"], string> = {
  S: "♠",
  H: "♥",
  C: "♣",
  D: "♦",
};


function Card({ card }: { card: PlayingCard }) {
  if (card.hidden) {
    return (
      <img
        src={CARD_BACK}
        alt="Face down card"
        className={`${CARD_SIZE} object-fill`}
        loading="lazy"
      />
    );
  }
  const red = card.suit === "H" || card.suit === "D";
  return (
    <span
      className={`${CARD_SIZE} inline-flex flex-col items-start justify-between bg-white px-[3px] py-[2px] font-bold leading-none ${
        red ? "text-red-600" : "text-black"
      }`}
    >
      <span className="text-[0.9rem]">{card.rank}</span>
      <span className="text-[0.95rem]">{SUIT_GLYPH[card.suit]}</span>
    </span>
  );
}




export function CardHand({ title, cards }: { title: string; cards: PlayingCard[] }) {
  return (
    <div className="space-y-1">
      <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-white/80">{title}</h3>
      <div className="flex gap-1">
        {cards.map((c, i) => (
          <Card key={i} card={c} />
        ))}
      </div>
    </div>
  );
}
