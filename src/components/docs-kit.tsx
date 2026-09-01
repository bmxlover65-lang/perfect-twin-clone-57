import type { ReactNode } from "react";

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.82em] text-foreground">
      {children}
    </code>
  );
}

export function Block({ label, code }: { label?: string; code: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border">
      {label ? (
        <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-1.5">
          <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="text-[0.7rem] text-muted-foreground">Copy</span>
        </div>
      ) : null}
      <pre className="overflow-x-auto bg-code-surface p-4 text-[0.78rem] leading-relaxed text-code-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Endpoint({
  method,
  path,
  auth,
}: {
  method: "GET" | "POST" | "GET / POST";
  path: string;
  auth?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
      <span className="rounded bg-board-header px-1.5 py-0.5 font-mono text-[0.7rem] font-bold text-board-header-foreground">
        {method}
      </span>
      <code className="font-mono text-sm text-foreground">{path}</code>
      {auth ? (
        <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[0.7rem] text-muted-foreground">
          {auth}
        </span>
      ) : null}
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-muted">
            {head.map((h) => (
              <th
                key={h}
                className="border-b border-border px-3 py-2 font-semibold text-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className="border-b border-border px-3 py-2 text-muted-foreground">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-md border-l-4 border-live-win bg-muted px-3 py-2 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="mt-4 flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-board-header text-xs font-bold text-board-header-foreground">
        {n}
      </span>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-12 scroll-mt-24 border-b border-border pb-2 text-2xl font-bold text-foreground"
    >
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 text-lg font-semibold text-foreground">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">{children}</p>;
}
