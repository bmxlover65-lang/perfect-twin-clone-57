import { useCallback, useEffect, useState } from "react";

type Props = {
  title: string;
  /** Paths relative to the proxy base, e.g. "sports" or "games/99.0010/state" */
  paths: { label: string; path: string }[];
};

const BASE = "/api/public/uapi";

export function LiveApiDemo({ title, paths }: Props) {
  const first = paths[0]?.path ?? "";
  const [path, setPath] = useState(first);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string>("idle");
  const [ms, setMs] = useState(0);

  const run = useCallback(async (p: string) => {
    if (!p) return;
    const started = Date.now();
    setStatus("loading…");
    try {
      const res = await fetch(`${BASE}/${p}`, { headers: { accept: "application/json" } });
      const json = await res.json();
      setBody(JSON.stringify(json, null, 2).slice(0, 4000));
      setStatus(`${res.status} ${res.ok ? "OK" : "ERROR"}`);
    } catch (e) {
      setBody(e instanceof Error ? e.message : "Request failed");
      setStatus("network error");
    } finally {
      setMs(Date.now() - started);
    }
  }, []);

  useEffect(() => {
    void run(path);
  }, [path, run]);

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-muted px-4 py-2.5">
        <h4 className="text-sm font-bold text-foreground">{title}</h4>
        <span className="text-xs text-muted-foreground">
          {status} · {ms} ms
        </span>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-border/60 px-4 py-3">
        {paths.map((p) => (
          <button
            key={p.path}
            type="button"
            onClick={() => setPath(p.path)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              p.path === path
                ? "bg-nav-active text-background"
                : "bg-muted text-foreground hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void run(path)}
          className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
        >
          Re-run
        </button>
      </div>
      <p className="px-4 pt-3 font-mono text-xs text-muted-foreground">
        GET {BASE}/{path}
      </p>
      <pre className="max-h-[320px] overflow-auto px-4 pb-4 pt-2 font-mono text-xs leading-relaxed text-foreground">
        {body || "…"}
      </pre>
    </div>
  );
}
