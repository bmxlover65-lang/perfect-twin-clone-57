import back from "@/assets/cards/0.png.asset.json";
import C3 from "@/assets/cards/C3.png.asset.json";
import CK from "@/assets/cards/CK.png.asset.json";
import D6 from "@/assets/cards/D6.png.asset.json";
import D8 from "@/assets/cards/D8.png.asset.json";
import D9 from "@/assets/cards/D9.png.asset.json";
import H2 from "@/assets/cards/H2.png.asset.json";
import H3 from "@/assets/cards/H3.png.asset.json";
import H7 from "@/assets/cards/H7.png.asset.json";
import H8 from "@/assets/cards/H8.png.asset.json";
import HK from "@/assets/cards/HK.png.asset.json";
import S5 from "@/assets/cards/S5.png.asset.json";
import { CARD_FACE_IMAGES } from "@/lib/card-faces";

/** Face-down / hidden card image. */
export const CARD_BACK = back.url;

/** Card face images keyed by feed code (suit letter + rank), e.g. "H8". */
export const CARD_IMAGES: Record<string, string> = {
  C3: C3.url,
  CK: CK.url,
  D6: D6.url,
  D8: D8.url,
  D9: D9.url,
  H2: H2.url,
  H3: H3.url,
  H7: H7.url,
  H8: H8.url,
  HK: HK.url,
  S5: S5.url,
};

/** Normalise a feed card code ("H8__", "h8", "D10", "ST") to "H8"; "0"/"" means face-down. */
export function normalizeCardCode(code: string): string {
  const clean = (code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!clean) return "";
  const suit = clean.slice(0, 1);
  let rank = clean.slice(1);
  if (rank === "1" || rank === "01") rank = "A";
  if (rank === "T") rank = "10";
  return `${suit}${rank}`;
}

/** Image URL for a card code (real card-face artwork), or null when face-down/unknown. */
export function cardImage(code: string): string | null {
  const c = normalizeCardCode(code);
  if (!c || c === "0" || c === "1" || c.length === 1) return null;
  return CARD_FACE_IMAGES[c] ?? CARD_IMAGES[c] ?? null;
}

/** Shared card shape/size — identical across every game and stage (real card ratio 2.5:3.5).
 *  Matches the live table overlay: compact on mobile, slightly larger on desktop. */
export const CARD_SIZE =
  "h-[36px] w-[26px] shrink-0 overflow-hidden rounded-[3px] shadow-md sm:h-[50px] sm:w-[36px] sm:rounded-[4px]";
