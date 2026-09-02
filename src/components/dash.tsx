import type { ReactNode } from "react";

export type DashTab = { id: string; label: string };

export const dashInput =
  "h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60";
export const dashBtn =
  "h-9 rounded-md bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60";
export const dashGhost =
  "h-8 rounded-md border border-border bg-background px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/60";

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/30 px-4 py-2.5">
        <h2 className="text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-foreground">
          {title}
        </h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-extrabold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** Sidebar dashboard shell shared by the admin console and the operator panel. */
export function DashShell({
  title,
  subtitle,
  accent,
  tabs,
  active,
  onSelect,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  tabs: DashTab[];
  active: string;
  onSelect: (id: string) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-[1280px] gap-5 px-3 py-6 md:grid-cols-[228px_minmax(0,1fr)]">
      <aside className="space-y-3 md:sticky md:top-4 md:self-start">
        <div
          className="rounded-xl border border-border p-4 shadow-sm"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklab, ${accent} 18%, var(--card)), var(--card))`,
          }}
        >
          <span
            className="inline-block rounded-full px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-white shadow-sm"
            style={{ background: accent }}
          >
            {title}
          </span>
          <p className="mt-2.5 break-words text-[0.72rem] leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        </div>

        <nav className="flex gap-1.5 overflow-x-auto rounded-xl border border-border bg-card p-2 shadow-sm md:flex-col md:overflow-visible">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-left text-xs font-bold transition-all md:w-full ${
                active === t.id
                  ? "text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
              style={
                active === t.id
                  ? { background: accent, boxShadow: `0 6px 16px -8px ${accent}` }
                  : undefined
              }
            >
              {t.label}
            </button>
          ))}
        </nav>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </aside>

      <main className="min-w-0 space-y-4">{children}</main>
    </div>
  );
}

