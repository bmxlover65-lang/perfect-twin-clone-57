import type { PlayingCard } from "@/lib/live-engine";
import { CardFace } from "@/components/CardFace";

export function CardHand({ title, cards }: { title: string; cards: PlayingCard[] }) {
  return (
    <div className="space-y-1">
      <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-white/80">{title}</h3>
      <div className="flex gap-1">
        {cards.map((c, i) => (
          <CardFace key={i} code={c.hidden ? "0" : `${c.suit}${c.rank}`} />
        ))}
      </div>
    </div>
  );
}
