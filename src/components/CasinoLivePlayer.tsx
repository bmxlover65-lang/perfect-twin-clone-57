import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, RefreshCw, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";

type CasinoLivePlayerProps = {
  src: string;
  title: string;
  className: string;
  loaderSrc: string;
};

type PlayerStatus = "connecting" | "live" | "reconnecting";

function retryDelay(attempt: number) {
  const exponential = Math.min(12_000, 800 * 2 ** Math.max(0, attempt));
  return Math.round(exponential * (0.85 + Math.random() * 0.3));
}

export function CasinoLivePlayer({ src, title, className, loaderSrc }: CasinoLivePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reload, setReload] = useState(0);
  const [muted, setMuted] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>("connecting");

  const reconnect = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setStatus("reconnecting");
    setAttempt((current) => {
      retryTimer.current = setTimeout(() => {
        setReload((value) => value + 1);
        setStatus("connecting");
      }, retryDelay(current));
      return Math.min(current + 1, 6);
    });
  }, []);

  useEffect(() => {
    setAttempt(0);
    setStatus("connecting");
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      iframeRef.current?.contentWindow?.postMessage({ type: "DESTROY" }, "*");
    };
  }, [src]);

  useEffect(() => {
    const onOffline = () => setStatus("reconnecting");
    const onOnline = () => reconnect();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [reconnect]);

  const framedSrc = `${src}${src.includes("?") ? "&" : "?"}muted=${muted ? "1" : "0"}&r=${reload}`;

  const toggleMute = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: muted ? "UNMUTE" : "MUTE" }, "*");
    setMuted((value) => !value);
    setReload((value) => value + 1);
    setStatus("connecting");
  };

  const enterFullscreen = () => {
    const frame = iframeRef.current;
    if (!frame) return;
    void frame.requestFullscreen?.();
  };

  return (
    <div className={`group/player relative overflow-hidden bg-code-surface ${className}`}>
      <iframe
        key={framedSrc}
        ref={iframeRef}
        title={title}
        src={framedSrc}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        onLoad={() => {
          setAttempt(0);
          setStatus("live");
        }}
        onError={reconnect}
        className="absolute inset-0 h-full w-full border-0 bg-code-surface"
      />

      {status !== "live" ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-code-surface">
          <img
            src={loaderSrc}
            alt=""
            aria-hidden="true"
            className="h-auto max-h-[72%] w-[42%] max-w-[180px] object-contain"
          />
        </div>
      ) : null}

      <span className="pointer-events-none absolute bottom-2 left-2 z-20 rounded-full border border-border/30 bg-code-surface/70 px-2.5 py-1 text-[0.62rem] font-bold uppercase text-primary-foreground backdrop-blur-md">
        {status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting…" : "Connecting…"}
      </span>

      <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/player:opacity-100 sm:group-focus-within/player:opacity-100">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          title="Reload live video"
          aria-label="Reload live video"
          onClick={() => {
            setStatus("connecting");
            setReload((value) => value + 1);
          }}
          className="h-8 w-8 bg-code-surface/75 text-primary-foreground hover:bg-code-surface"
        >
          <RefreshCw />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          title={muted ? "Turn sound on" : "Mute sound"}
          aria-label={muted ? "Turn sound on" : "Mute sound"}
          onClick={toggleMute}
          className="h-8 w-8 bg-code-surface/75 text-primary-foreground hover:bg-code-surface"
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          title="Full screen"
          aria-label="Full screen"
          onClick={enterFullscreen}
          className="h-8 w-8 bg-code-surface/75 text-primary-foreground hover:bg-code-surface"
        >
          <Maximize />
        </Button>
      </div>
    </div>
  );
}