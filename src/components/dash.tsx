import type { ReactNode } from "react";

export type DashTab = { id: string; label: string };

export const dashInput =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground";
export const dashBtn = "h-9 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground";
export const dashGhost =
  "h-8 rounded-md border border-border px-2 text-xs font-semibold text-foreground";

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-extrabold text-foreground">{value}</p>
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
    <div className="mx-auto grid max-w-[1200px] gap-4 px-3 py-5 md:grid-cols-[210px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-white"
            style={{ background: accent }}
          >
            {title}
          </span>
          <p className="mt-2 break-words text-[0.72rem] text-muted-foreground">{subtitle}</p>
        </div>

        <nav className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-card p-2 md:flex-col md:overflow-visible">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`shrink-0 rounded-md px-3 py-2 text-left text-xs font-bold transition-colors md:w-full ${
                active === t.id
                  ? "text-white"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
              style={active === t.id ? { background: accent } : undefined}
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
