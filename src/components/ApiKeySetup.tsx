import { useEffect, useState } from "react";

const STORE = "uapi_b2b_key";
const STORE_BASE = "uapi_b2b_base";
const DEFAULT_BASE = "https://universalapi.store/api";

export function ApiKeySetup() {
  const [key, setKey] = useState("");
  const [base, setBase] = useState(DEFAULT_BASE);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<string>("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setKey(localStorage.getItem(STORE) ?? "");
    setBase(localStorage.getItem(STORE_BASE) ?? DEFAULT_BASE);
  }, []);

  const save = () => {
    localStorage.setItem(STORE, key.trim());
    localStorage.setItem(STORE_BASE, base.trim() || DEFAULT_BASE);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const test = async () => {
    setTesting(true);
    setResult("");
    try {
      const h = await fetch("/api/public/uapi/health", { headers: { accept: "application/json" } });
      const health = (await h.json()) as {
        ok?: boolean;
        keyConfigured?: boolean;
        authMode?: string;
        latencyMs?: number;
        error?: string;
      };
      const res = await fetch("/api/public/uapi/sports", {
        headers: { accept: "application/json" },
      });
      const json = (await res.json()) as { sports?: unknown[]; error?: string };
      const auth = health.keyConfigured
        ? "server key: configured (B2B)"
        : "server key: missing (public session)";
      setResult(
        res.ok
          ? `200 OK · ${json.sports?.length ?? 0} sports · ${health.latencyMs ?? 0}ms · ${auth}`
          : `${res.status} · ${json.error ?? health.error ?? "request failed"} · ${auth}`,
      );
    } catch (e) {
      setResult(e instanceof Error ? e.message : "network error");
    } finally {
      setTesting(false);
    }
  };


  const masked = key ? `${key.slice(0, 9)}${"•".repeat(Math.max(0, key.length - 9))}` : "";

  return (
    <div className="my-5 rounded-xl border border-border/60 bg-card p-4">
      <h4 className="text-sm font-bold text-foreground">Your key setup</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Stored only in this browser to generate your snippets. Production keys must live in a server
        environment variable.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted-foreground">
          API key
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="uapi_live_xxxxxxxxxxxxxxxx"
            className="mt-1 w-full rounded-lg border border-border/60 bg-muted px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-nav-active"
          />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Base URL
          <input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border/60 bg-muted px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-nav-active"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          className="rounded-full bg-nav-active px-4 py-1.5 text-xs font-bold text-background"
        >
          {saved ? "Saved" : "Save key"}
        </button>
        <button
          type="button"
          onClick={() => void test()}
          className="rounded-full bg-muted px-4 py-1.5 text-xs font-bold text-foreground hover:bg-accent"
        >
          {testing ? "Testing…" : "Test proxy"}
        </button>
        {result ? <span className="text-xs text-muted-foreground">{result}</span> : null}
      </div>
      <pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-foreground">
        {`# .env (backend only)
UAPI_BASE_URL=${base || DEFAULT_BASE}
UAPI_KEY=${masked || "uapi_live_xxxxxxxxxxxxxxxx"}

# verify
curl -s "${base || DEFAULT_BASE}/sports" -H "X-API-Key: $UAPI_KEY"`}
      </pre>
    </div>
  );
}
