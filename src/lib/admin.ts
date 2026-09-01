import { useEffect, useState } from "react";

const KEY = "uapi_admin_cfg";
const FLAG = "uapi_admin";
const EVT = "uapi-admin-change";

export type GameOverride = {
  mode: "real" | "forced";
  value: string;
};

export type AviatorControl = {
  mode: "real" | "never" | "forced";
  crash: number;
};

export type AdminConfig = {
  games: Record<string, GameOverride>;
  aviator: AviatorControl;
};

export const DEFAULT_CONFIG: AdminConfig = {
  games: {},
  aviator: { mode: "real", crash: 2 },
};

export function readConfig(): AdminConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AdminConfig>;
    return {
      games: parsed.games ?? {},
      aviator: { ...DEFAULT_CONFIG.aviator, ...(parsed.aviator ?? {}) },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function writeConfig(cfg: AdminConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(cfg));
  window.dispatchEvent(new Event(EVT));
}

export function isAdminStored(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FLAG) === "1";
}

export function setAdminStored(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) window.localStorage.setItem(FLAG, "1");
  else window.localStorage.removeItem(FLAG);
  window.dispatchEvent(new Event(EVT));
}

export function useAdminConfig(): { admin: boolean; cfg: AdminConfig } {
  const [admin, setAdmin] = useState(false);
  const [cfg, setCfg] = useState<AdminConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const sync = () => {
      setAdmin(isAdminStored());
      setCfg(readConfig());
    };
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { admin, cfg };
}

/** Effective winner for a game: admin override wins when set. */
export function applyOverride(
  cfg: AdminConfig,
  admin: boolean,
  gameId: string,
  real: string | null,
): string | null {
  if (!admin) return real;
  const o = cfg.games[gameId];
  if (o && o.mode === "forced" && o.value) return o.value;
  return real;
}
