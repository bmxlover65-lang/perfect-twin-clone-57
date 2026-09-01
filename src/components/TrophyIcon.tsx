const TROPHY_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23000' d='M400 0H112v32H24C10.7 32 0 42.7 0 56v40c0 57.4 46.6 104 104 104h13.6c17.7 39.6 53.3 69.2 96.4 78.1V416h-48c-26.5 0-48 21.5-48 48v16h276v-16c0-26.5-21.5-48-48-48h-48v-137.9c43.1-8.9 78.7-38.5 96.4-78.1H408c57.4 0 104-46.6 104-104V56c0-13.3-10.7-24-24-24h-88V0zM48 96V80h64v24c0 16.5 2.4 32.5 6.8 47.6C79.9 146.2 48 124.6 48 96zm416 0c0 28.6-31.9 50.2-70.8 55.6 4.4-15.1 6.8-31.1 6.8-47.6V80h64v16z'/%3E%3C/svg%3E\")";

export function TrophyIcon({ variant }: { variant: "winner" | "loser" }) {
  return (
    <span
      aria-hidden
      className={variant === "winner" ? "text-live-win" : "text-live-lose"}
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        verticalAlign: "middle",
        background: "currentColor",
        transform: variant === "loser" ? "rotate(180deg)" : undefined,
        maskImage: TROPHY_MASK,
        WebkitMaskImage: TROPHY_MASK,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
