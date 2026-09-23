import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { auditGameUi } from "@/lib/ui-audit.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/ui-audit")({
  component: UiAuditPage,
  head: () => ({
    meta: [
      { title: "Casino UI audit | Universal API" },
      {
        name: "description",
        content:
          "Compare a live casino game screenshot with a reference screenshot and find UI mismatches, wrong suspend states and overlap issues.",
      },
      { property: "og:title", content: "Casino UI audit | Universal API" },
      {
        property: "og:description",
        content: "AI comparison of live casino boards against reference screenshots.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

function Dropzone({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string;
  onPick: (dataUrl: string) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-border bg-card p-3 text-center shadow-sm">
      <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {value ? (
        <img
          src={value}
          alt={label}
          className="mx-auto max-h-[320px] w-auto rounded-md border border-border"
        />
      ) : (
        <span className="py-8 text-[0.8rem] text-muted-foreground">
          Tap to choose a screenshot
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onPick(await readFile(file));
        }}
      />
    </label>
  );
}

function UiAuditPage() {
  const runAudit = useServerFn(auditGameUi);
  const [gameLabel, setGameLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [current, setCurrent] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState("");

  const submit = async () => {
    setError("");
    setReport("");
    if (!current || !reference) {
      setError("Please add both screenshots.");
      return;
    }
    setBusy(true);
    try {
      const out = await runAudit({
        data: { gameLabel, currentImage: current, referenceImage: reference, notes },
      });
      setReport(out.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The audit failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-[980px] gap-4 px-3 py-6">
      <header className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h1 className="text-lg font-extrabold">Casino UI audit</h1>
        <p className="mt-1 text-[0.8rem] text-muted-foreground">
          Upload our current game screenshot and the reference screenshot. The audit reports
          layout mismatches, wrong suspended states and overlapping text.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={gameLabel}
          onChange={(e) => setGameLabel(e.target.value)}
          placeholder="Game (e.g. Amar Akbar Anthony 99.0005)"
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything specific to check (optional)"
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Dropzone label="Our current build" value={current} onPick={setCurrent} />
        <Dropzone label="Reference" value={reference} onPick={setReference} />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy}>
          {busy ? "Comparing…" : "Run audit"}
        </Button>
        {busy ? (
          <span className="text-[0.78rem] text-muted-foreground">
            This can take up to a minute.
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-[0.82rem] text-destructive">
          {error}
        </p>
      ) : null}

      {report ? (
        <pre className="whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-[0.82rem] leading-relaxed shadow-sm">
          {report}
        </pre>
      ) : null}
    </div>
  );
}
