import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  type AdminConfig,
  DEFAULT_CONFIG,
  isAdminStored,
  readConfig,
  setAdminStored,
  writeConfig,
} from "@/lib/admin";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Result Control Panel | Universal API" },
      {
        name: "description",
        content:
          "Operator control room: force round results for Lucky 0-9, Dream Catcher, Heads & Tails, Balloon and Aviator, or keep the real live feed.",
      },
      { property: "og:title", content: "Result Control Panel | Universal API" },
      {
        property: "og:description",
        content: "Force or release live round results for Universe Original games.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const GAMES: { id: string; name: string; options: string[] }[] = [
  { id: "88.0019", name: "Lucky 0 to 9", options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] },
  { id: "88.0020", name: "Dream Catcher", options: ["1", "2", "5", "10", "20", "40"] },
  { id: "88.0021", name: "Heads & Tails", options: ["HEADS", "TAILS"] },
  {
    id: "88.0023",
    name: "Balloon (crash multiplier)",
    options: ["1.10", "1.50", "2.00", "3.00", "5.00", "10.00", "25.00"],
  },
];

function AdminPage() {
  const [admin, setAdmin] = useState(false);
  const [cfg, setCfg] = useState<AdminConfig>(DEFAULT_CONFIG);
  const [pass, setPass] = useState("");

  useEffect(() => {
    setAdmin(isAdminStored());
    setCfg(readConfig());
  }, []);

  const save = (next: AdminConfig) => {
    setCfg(next);
    writeConfig(next);
  };

  const setGame = (id: string, mode: "real" | "forced", value: string) =>
    save({ ...cfg, games: { ...cfg.games, [id]: { mode, value } } });

  if (!admin) {
    return (
      <div className="mx-auto max-w-[420px] px-4 py-16">
        <h1 className="text-[1.4rem] font-extrabold text-foreground">Operator login</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the control-room passcode to manage round results.
        </p>
        <input
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          type="password"
          placeholder="Passcode"
          className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={() => {
            if (pass === "universe") {
              setAdminStored(true);
              setAdmin(true);
            }
          }}
          className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
        >
          Unlock
        </button>
        <Link to="/" className="mt-4 block text-sm text-muted-foreground hover:text-foreground">
          ← Back to lobby
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[860px] px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.5rem] font-extrabold text-foreground">Result control panel</h1>
          <p className="text-sm text-muted-foreground">
            Real feed runs by default. Force a result and every player screen shows your outcome.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdminStored(false);
            setAdmin(false);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-foreground"
        >
          Lock
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {GAMES.map((g) => {
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
                        o.mode === m
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
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
              <p className="text-[0.95rem] font-bold text-foreground">Aviator</p>
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

      <Link to="/" className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Back to lobby
      </Link>
    </div>
  );
}
