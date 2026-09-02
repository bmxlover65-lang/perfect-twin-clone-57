import { useEffect, useRef, useState } from "react";

/**
 * Renders the upstream live scoreboard inline (same-origin proxy fetch) so it
 * blends with the site panel instead of sitting in a black iframe box.
 */
export function Scoreboard({ sportId, eventId }: { sportId: string; eventId: string }) {
  const [html, setHtml] = useState<string>("");
  const [css, setCss] = useState<string>("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const url = `/api/public/uapi/tv/sports/scoreboard?sportId=${sportId}&exEventId=${eventId}&tv=true`;

    const pull = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, "text/html");
        const root = doc.getElementById("score-root");
        if (!alive.current || !root) return;
        setHtml(root.innerHTML);
        const style = Array.from(doc.querySelectorAll("style"))
          .map((s) => s.textContent ?? "")
          .join("\n");
        setCss(style);
      } catch {
        /* keep last frame */
      }
    };

    void pull();
    const t = window.setInterval(pull, 4000);
    return () => {
      alive.current = false;
      window.clearInterval(t);
    };
  }, [sportId, eventId]);

  return (
    <div className="scoreboard-embed">
      <style>{`
        .scoreboard-embed { --mc-bg: transparent; }
        .scoreboard-embed :where(html, body) { background: transparent !important; }
        ${css}
        .scoreboard-embed .board {
          background: transparent !important;
          padding: 14px 14px 18px;
          font-family: inherit;
        }
        /* shared grid: TEAM | SCORE | OVS | RR | 4S | 6S | WD */
        .scoreboard-embed .header-row,
        .scoreboard-embed .team-row {
          display: grid !important;
          grid-template-columns: minmax(96px, 1.6fr) minmax(66px, 0.9fr) minmax(54px, 0.7fr) minmax(56px, 0.7fr) minmax(34px, 0.45fr) minmax(34px, 0.45fr) minmax(38px, 0.5fr);
          align-items: center !important;
          gap: 4px !important;
          padding: 0 2px;
        }
        .scoreboard-embed .team-row {
          min-height: 46px;
          padding: 6px 2px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .scoreboard-embed .team-row:last-of-type { border-bottom: 0; }
        .scoreboard-embed .header-row {
          margin-bottom: 2px;
          font-size: 13px;
          font-weight: 700;
          color: var(--mc-add);
        }
        .scoreboard-embed .team-meta,
        .scoreboard-embed .stats { width: auto !important; }
        .scoreboard-embed .stats {
          display: contents !important;
        }
        .scoreboard-embed .stat {
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: nowrap;
        }
        .scoreboard-embed .stats.head .stat {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--mc-add);
        }
        .scoreboard-embed .stat.score { font-size: 17px; font-weight: 800; color: var(--mc-fg); }
        .scoreboard-embed .head-label { visibility: hidden; height: 20px; }
        .scoreboard-embed .team-line { gap: 7px; }
        .scoreboard-embed .team-name { font-size: 14px; font-weight: 800; }
        .scoreboard-embed .player { display: none; }
        .scoreboard-embed .role { font-size: 10px; font-weight: 800; padding: 2px 5px; border-radius: 3px; }
        .scoreboard-embed .status { margin-top: 12px; font-size: 13px; text-align: center; }
        .scoreboard-embed .balls { margin-top: 10px; gap: 8px; }
        .scoreboard-embed .ball { width: 29px; height: 29px; font-size: 11px; font-weight: 800; }
      `}</style>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">Loading scoreboard…</p>
      )}
    </div>
  );
}

