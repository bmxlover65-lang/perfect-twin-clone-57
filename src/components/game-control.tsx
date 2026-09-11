import type React from "react";
import { useEffect, useState } from "react";
import {
  type AdminConfig,
  DEFAULT_CONFIG,
  readConfig,
  setAdminStored,
  writeConfig,
} from "@/lib/admin";
import { clearTelemetry, useTelemetry } from "@/lib/telemetry";
import { GAMES as GAME_LIST } from "@/data/games";

/** Hand-tuned option lists where the feed labels differ from the game data. */
const CUSTOM_OPTIONS: Record<string, string[]> = {
  "88.0019": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  "88.0020": ["1", "2", "5", "10", "20", "40"],
  "88.0021": ["HEADS", "TAILS"],
  "88.0023": ["1.10", "1.50", "2.00", "3.00", "5.00", "10.00", "25.00"],
};

/** Every casino table (VIMAAN has its own crash card below). */
const CONTROL_GAMES: { id: string; name: string; options: string[] }[] = GAME_LIST.filter(
  (g) => g.kind !== "aviator",
).map((g) => {
  const fromMarkets = g.markets[0]?.runners ?? [];
  const options =
    CUSTOM_OPTIONS[g.id] ??
    Array.from(new Set([...fromMarkets, ...g.results].map((s) => s.trim()).filter(Boolean)));
  return { id: g.id, name: g.name, options };
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-[0.85rem] font-bold text-foreground">{title}</p>
      <div className="max-h-[280px] overflow-auto">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[0.78rem] text-muted-foreground">{text}</p>;
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[1.3rem] font-extrabold text-foreground">{value}</p>
    </div>
  );
}

export function GameControl() {
  const [cfg, setCfg] = useState<AdminConfig>(DEFAULT_CONFIG);
  const tele = useTelemetry();

  useEffect(() => {
    setAdminStored(true);
    setCfg(readConfig());
  }, []);

  const save = (next: AdminConfig) => {
    setCfg(next);
    writeConfig(next);
  };

  const setGame = (id: string, mode: "real" | "forced", value: string) =>
    save({ ...cfg, games: { ...cfg.games, [id]: { mode, value } } });

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatBox label="Player balance" value={`${tele.balance.toFixed(2)} INR`} />
        <StatBox label="My bets logged" value={String(tele.bets.length)} />
        <StatBox label="Chat messages" value={String(tele.chat.length)} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card title="My Bets">
          {tele.bets.length === 0 ? (
            <Empty text="No bets yet." />
          ) : (
            <table className="w-full text-[0.75rem]">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="py-1">Game</th>
                  <th>Round</th>
                  <th className="text-right">Stake</th>
                  <th className="text-right">X</th>
                  <th className="text-right">Win</th>
                </tr>
              </thead>
              <tbody>
                {tele.bets.slice(0, 30).map((b, i) => (
                  <tr key={i} className="border-t border-border/60 text-foreground">
                    <td className="py-1">{b.gameName}</td>
                    <td className="text-muted-foreground">{b.round}</td>
                    <td className="text-right">{b.stake.toFixed(2)}</td>
                    <td className="text-right">{b.multiplier ? `${b.multiplier.toFixed(2)}x` : "—"}</td>
                    <td className="text-right font-bold">{b.payout.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Chat messages">
          {tele.chat.length === 0 ? (
            <Empty text="No messages yet." />
          ) : (
            <ul className="space-y-1 text-[0.78rem]">
              {tele.chat.slice(0, 30).map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-bold text-primary">{c.user}</span>
                  <span className="min-w-0 flex-1 text-foreground">{c.text}</span>
                  <span className="shrink-0 text-[0.68rem] text-muted-foreground">
                    {new Date(c.ts).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-3">
        <Card title="Result history — real vs my result">
          {tele.results.length === 0 ? (
            <Empty text="No rounds recorded yet. Open a game to start logging." />
          ) : (
            <table className="w-full text-[0.75rem]">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="py-1">Time</th>
                  <th>Game</th>
                  <th>Round</th>
                  <th>Real</th>
                  <th>Shown</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {tele.results.slice(0, 40).map((r, i) => (
                  <tr key={i} className="border-t border-border/60 text-foreground">
                    <td className="py-1 text-muted-foreground">
                      {new Date(r.ts).toLocaleTimeString()}
                    </td>
                    <td>{r.gameName}</td>
                    <td className="text-muted-foreground">{r.round}</td>
                    <td className="font-bold">{r.real}</td>
                    <td className="font-bold">{r.shown}</td>
                    <td className={r.forced ? "font-bold text-primary" : "text-muted-foreground"}>
                      {r.forced ? "My result" : "Real"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button
            type="button"
            onClick={() => clearTelemetry()}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-[0.75rem] font-semibold text-foreground"
          >
            Clear dashboard data
          </button>
        </Card>
      </div>

      <h2 className="mt-6 text-[1.05rem] font-extrabold text-foreground">Result controls</h2>
      <div className="mt-3 space-y-3">
        {CONTROL_GAMES.map((g) => {
          const o = cfg.games[g.id] ?? { mode: "real" as const, value: g.options[0]! };
          return (
            <div key={g.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[0.95rem] font-bold text-foreground">{g.name}</p>
                  <p className="text-[0.72rem] text-muted-foreground">{g.id}</p>
                </div>
                <div className="flex rounded-full bg-muted p-[3px] text-[0.72rem] font-bold">
                  {(["real", "forced"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setGame(g.id, m, o.value)}
                      className={`rounded-full px-3 py-1 ${
                        o.mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {m === "real" ? "Real result" : "My result"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {g.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={o.mode !== "forced"}
                    onClick={() => setGame(g.id, "forced", opt)}
                    className={`rounded-md border px-3 py-1.5 text-[0.8rem] font-bold disabled:opacity-40 ${
                      o.mode === "forced" && o.value === opt
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-foreground"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.95rem] font-bold text-foreground">VIMAAN</p>
              <p className="text-[0.72rem] text-muted-foreground">88.0030 · crash control</p>
            </div>
            <div className="flex rounded-full bg-muted p-[3px] text-[0.72rem] font-bold">
              {(["real", "never", "forced"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => save({ ...cfg, aviator: { ...cfg.aviator, mode: m } })}
                  className={`rounded-full px-3 py-1 ${
                    cfg.aviator.mode === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {m === "real" ? "Normal" : m === "never" ? "No win" : "Fixed x"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[0.8rem] text-muted-foreground">Fixed crash point</span>
            <input
              type="number"
              step="0.01"
              min="1"
              value={cfg.aviator.crash}
              disabled={cfg.aviator.mode !== "forced"}
              onChange={(e) =>
                save({
                  ...cfg,
                  aviator: { ...cfg.aviator, crash: Math.max(1, Number(e.target.value) || 1) },
                })
              }
              className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-40"
            />
            <span className="text-[0.75rem] text-muted-foreground">
              “No win” busts every round at 1.00x.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
