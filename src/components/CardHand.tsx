import type { PlayingCard } from "@/lib/live-engine";
import { CARD_BACK, cardImage } from "@/lib/card-assets";

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
        className="h-[62px] w-[44px] rounded-[4px] object-cover shadow"
        loading="lazy"
      />
    );
  }
  const img = cardImage(`${card.suit}${card.rank}`);
  if (img) {
    return (
      <img
        src={img}
        alt={`${card.rank} ${card.suit}`}
        className="h-[62px] w-[44px] rounded-[4px] bg-white object-cover shadow"
        loading="lazy"
      />
    );
  }
  const red = card.suit === "H" || card.suit === "D";
  return (
    <div className="flex h-[62px] w-[44px] flex-col justify-between rounded-[4px] bg-white p-1 shadow">
      <span
        className={`text-xs font-bold leading-none ${red ? "text-card-red" : "text-card-black"}`}
      >
        {card.rank}
      </span>
      <span
        className={`self-end text-lg leading-none ${red ? "text-card-red" : "text-card-black"}`}
      >
        {SUIT_GLYPH[card.suit]}
      </span>
    </div>
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
