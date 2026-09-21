import { useEffect, useRef, useState } from "react";
import { AppLoader } from "@/components/AppLoader";

/**
 * Renders the upstream live scoreboard inline (same-origin proxy fetch) so it
 * blends with the site panel instead of sitting in a black iframe box.
 */
/** Sports the live feed's own scoreboard service covers. */
const AURA_SCORE_SPORTS = new Set(["1", "2", "4"]);
const AURA_SCORE_BASE = "https://ori.exchange24x7.live";

export function Scoreboard({ sportId, eventId }: { sportId: string; eventId: string }) {
  const [html, setHtml] = useState<string>("");
  const [css, setCss] = useState<string>("");
  const alive = useRef(true);
  const useAura = AURA_SCORE_SPORTS.has(sportId) && !eventId.startsWith("sf:");

  useEffect(() => {
    if (useAura) return;
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
  }, [sportId, eventId, useAura]);

  if (useAura) {
    const src = `${AURA_SCORE_BASE}/scoreboard/index.html?sportId=${encodeURIComponent(
      sportId,
    )}&eventId=${encodeURIComponent(eventId)}`;
    return (
      <iframe
        title="Live scoreboard"
        src={src}
        loading="lazy"
        className="h-[220px] w-full border-0 bg-black sm:h-[260px]"
      />
    );
  }

  return (
    <div className="scoreboard-embed bg-black">
      <style>{`
        .scoreboard-embed { --mc-bg: transparent; background: #000000; }
        .scoreboard-embed :where(html, body) { background: transparent !important; }
        ${css}
        .scoreboard-embed .board {
          background: #000000 !important;
          padding: 12px 14px 16px;
          font-family: inherit;
        }
        /* shared grid: TEAM | SCORE | OVS | RR | 4S | 6S | WD */
        .scoreboard-embed .header-row,
        .scoreboard-embed .team-row {
          display: grid !important;
          grid-template-columns: minmax(110px, 2.2fr) 76px 62px 72px 40px 40px 44px;
          align-items: center !important;
          gap: 0 !important;
          padding: 0 2px;
        }
        .scoreboard-embed .team-row {
          min-height: 42px;
          padding: 4px 2px;
          border-bottom: 1px solid #1D1D1D;
        }
        .scoreboard-embed .team-row:last-of-type { border-bottom: 0; }
        .scoreboard-embed .header-row {
          margin-bottom: 2px;
          font-size: 13px;
          font-weight: 700;
          color: #FFFFFF;
        }
        .scoreboard-embed .team-meta,
        .scoreboard-embed .stats { width: auto !important; }
        .scoreboard-embed .stats { display: contents !important; }
        .scoreboard-embed .stat {
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          color: #E6E6E6;
          min-width: 0;
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: nowrap;
        }
        .scoreboard-embed .stats.head .stat {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          color: #FFFFFF;
        }
        .scoreboard-embed .stat.score { font-size: 17px; font-weight: 800; color: #FFFFFF; }
        .scoreboard-embed .head-label { visibility: hidden; height: 18px; }
        .scoreboard-embed .team-line { gap: 7px; }
        .scoreboard-embed .team-name { font-size: 14px !important; font-weight: 700 !important; color: #FFFFFF !important; }
        .scoreboard-embed .player { display: none; }
        .scoreboard-embed .role {
          min-width: 29px; height: 17px; display: inline-flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 800; padding: 0 4px; border-radius: 3px;
          background: #1E90FF !important; color: #FFFFFF !important;
        }
        .scoreboard-embed .status { margin-top: 13px; font-size: 13px; text-align: center; color: #D8D8D8; }
        .scoreboard-embed .balls { margin-top: 10px; gap: 7px; }
        .scoreboard-embed .ball { width: 28px; height: 28px; font-size: 11px; font-weight: 800; color: #fff; }
      `}</style>

      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <AppLoader compact />
      )}
    </div>
  );
}

