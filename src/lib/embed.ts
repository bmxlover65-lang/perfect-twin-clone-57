import { useRouterState } from "@tanstack/react-router";

/**
 * Game launch / embed mode.
 *
 * Operators launch a single game with `?embed=1` (optionally `&mobile=1`).
 * In this mode the site chrome (header, nav, back-to-lobby links, page
 * padding) is removed so only the game itself renders inside their iframe
 * or webview — exactly what a player should see on mobile.
 */
export function useEmbed(): boolean {
  return useRouterState({
    select: (s) => {
      const q = s.location.search as Record<string, unknown>;
      const v = q?.["embed"];
      return v === true || v === 1 || v === "1" || v === "true";
    },
  });
}
