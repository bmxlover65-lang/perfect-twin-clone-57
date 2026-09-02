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
        .scoreboard-embed .board { background: transparent !important; padding: 12px 14px 16px; }
      `}</style>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">Loading scoreboard…</p>
      )}
    </div>
  );
}
