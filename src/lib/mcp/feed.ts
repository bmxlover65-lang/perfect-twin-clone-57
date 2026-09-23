// Reads the app's own public sports proxy. No secrets, no module-level I/O.
const BASE = "https://universalapi.store/api/public/uapi";

export async function feedGet(path: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(`${BASE}/${path}`, { headers: { accept: "application/json" }, signal: signal ?? null });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
  return json;
}
