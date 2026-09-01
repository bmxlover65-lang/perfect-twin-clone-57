import { TrophyIcon } from "./TrophyIcon";

export function RecentResults({
  results,
  winner,
}: {
  results: string[];
  winner: string;
}) {
  return (
    <section className="mt-3 rounded-md bg-card p-3">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Recent Result
        </h5>
        <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
          <TrophyIcon variant="winner" /> Last: {winner}
        </span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {results.map((r, i) => (
          <li
            key={i}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[0.7rem] font-bold text-secondary-foreground"
          >
            {r}
          </li>
        ))}
      </ul>
    </section>
  );
}
