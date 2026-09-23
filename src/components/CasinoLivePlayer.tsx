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

    </div>
  );
}