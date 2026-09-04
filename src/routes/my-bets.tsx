import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useWallet } from "@/lib/wallet";

export const Route = createFileRoute("/my-bets")({
  head: () => ({
    meta: [
      { title: "My Bets — Universal API Player History" },
      {
        name: "description",
        content:
          "Track every casino and sports bet placed on Universal API: stake, odds, round and settled payout in one live history.",
      },
      { property: "og:title", content: "My Bets — Universal API Player History" },
      {
        property: "og:description",
        content: "Live bet history with stake, odds and settled payout for casino and sports rounds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyBetsPage,
});

const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
] as const;

function MyBetsPage() {
  const wallet = useWallet();
  const [filter, setFilter] = useState<string>("all");

  const rows = useMemo(
    () => (filter === "all" ? wallet.bets : wallet.bets.filter((b) => b.status === filter)),
    [wallet.bets, filter],
  );

  const staked = wallet.bets.reduce((s, b) => s + b.stake, 0);
  const won = wallet.bets.filter((b) => b.status === "won").reduce((s, b) => s + b.payout, 0);
  const lost = wallet.bets.filter((b) => b.status === "lost").reduce((s, b) => s + b.stake, 0);

  return (
    <div className="mx-auto max-w-[1000px] space-y-4 px-3 py-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold text-foreground">
            My Bets — Player History
          </h1>
          <p className="text-xs text-muted-foreground">Casino aur sports — har bet ka record.</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#123A73] px-3 py-1 text-sm font-extrabold text-white">
          Bal ₹{Math.round(wallet.balance).toLocaleString("en-IN")}
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total staked", value: staked },
          { label: "Returned", value: won },
          { label: "Lost", value: lost },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 text-lg font-extrabold text-foreground">
              ₹{Math.round(s.value).toLocaleString("en-IN")}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`h-8 rounded-md px-3 text-xs font-bold ${
              filter === f.id
                ? "bg-[#123A73] text-white"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">Game</th>
              <th className="p-2 text-left">Selection</th>
              <th className="p-2 text-right">Odds</th>
              <th className="p-2 text-right">Stake</th>
              <th className="p-2 text-right">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="p-2 text-muted-foreground">
                  {new Date(b.ts).toLocaleTimeString()}
                </td>
                <td className="p-2 text-foreground">{b.gameName || b.gameId}</td>
                <td className="p-2 font-semibold text-foreground">{b.label}</td>
                <td className="p-2 text-right text-foreground">{b.odds.toFixed(2)}</td>
                <td className="p-2 text-right text-foreground">
                  {b.stake.toLocaleString("en-IN")}
                </td>
                <td className="p-2 text-right font-extrabold">
                  {b.status === "open" ? (
                    <span className="text-[#E8871E]">OPEN</span>
                  ) : b.status === "won" ? (
                    <span className="text-live-win">+{Math.round(b.payout).toLocaleString("en-IN")}</span>
                  ) : (
                    <span className="text-destructive">-{b.stake.toLocaleString("en-IN")}</span>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={6}>
                  Koi bet nahi mila. <Link to="/" className="underline">Games kholo</Link>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
