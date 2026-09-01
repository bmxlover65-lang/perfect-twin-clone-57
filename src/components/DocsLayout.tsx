import type { ReactNode } from "react";

export interface DocSection {
  id: string;
  title: string;
  description: string;
  method: "GET" | "POST";
  path: string;
  sample: string;
}

export function DocsLayout({
  title,
  intro,
  sections,
  children,
}: {
  title: string;
  intro: string;
  sections: DocSection[];
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Universal API
          </p>
          <nav className="mt-3 space-y-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        <main>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{intro}</p>
          {children}
          <div className="mt-8 space-y-8">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-xl font-semibold text-foreground">{s.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">
                  <span className="rounded bg-board-header px-1.5 py-0.5 text-[0.7rem] font-bold text-board-header-foreground">
                    {s.method}
                  </span>
                  <code className="text-foreground">{s.path}</code>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-md bg-code-surface p-4 text-[0.8rem] leading-relaxed text-code-foreground">
                  <code>{s.sample}</code>
                </pre>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
