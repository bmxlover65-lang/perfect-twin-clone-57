import type { LiveMarket } from "@/lib/live-engine";

export function OddsBoard({ market }: { market: LiveMarket }) {
  return (
    <section className="mt-2">
      <header className="flex items-center justify-between bg-board-header px-2 py-1 text-[0.72rem] font-bold text-board-header-foreground">
        <span>{market.title}</span>
        <span className="font-normal opacity-80">
          Min/Max: {market.min} - {market.max}
        </span>
      </header>
      <div className="relative bg-board-body p-2">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(market.runners.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {market.runners.map((r) => (
            <div key={r.label} className="text-center">
              <div className="text-[0.7rem] font-semibold uppercase text-board-body-foreground">
                {r.label}
              </div>
              <button
                type="button"
                disabled={market.suspended}
                className="mt-1 w-full rounded-md bg-back-odds px-2 py-1.5 leading-tight transition-colors hover:bg-back-odds-hover disabled:cursor-not-allowed"
              >
                <span className="block text-sm font-bold text-back-odds-foreground">
                  {r.odds.toFixed(2)}
                </span>
                <span className="block text-[0.68rem] text-back-odds-foreground/70">
                  {r.volume}
                </span>
              </button>
            </div>
          ))}
        </div>
        {market.suspended && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="text-lg font-extrabold uppercase tracking-wide text-white">
              Suspended
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
