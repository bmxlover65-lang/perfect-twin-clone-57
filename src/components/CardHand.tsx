import type { PlayingCard } from "@/lib/live-engine";

const SUIT_GLYPH: Record<PlayingCard["suit"], string> = {
  S: "♠",
  H: "♥",
  C: "♣",
  D: "♦",
};

function Card({ card }: { card: PlayingCard }) {
  if (card.hidden) {
    return (
      <div className="h-[62px] w-[44px] rounded-[4px] border border-white/20 bg-[repeating-linear-gradient(45deg,oklch(0.35_0.09_265)_0_5px,oklch(0.25_0.07_265)_5px_10px)]" />
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
