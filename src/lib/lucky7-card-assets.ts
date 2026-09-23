import { CARD_FACE_IMAGES } from "@/lib/card-faces";

/** Lucky 7 "Lucky Card" market uses real spade card faces, one per rank. */
export const LUCKY7_CARD_IMAGES: Record<string, string> = {
  A: CARD_FACE_IMAGES["SA"]!,
  "2": CARD_FACE_IMAGES["S2"]!,
  "3": CARD_FACE_IMAGES["S3"]!,
  "4": CARD_FACE_IMAGES["S4"]!,
  "5": CARD_FACE_IMAGES["S5"]!,
  "6": CARD_FACE_IMAGES["S6"]!,
  "7": CARD_FACE_IMAGES["S7"]!,
  "8": CARD_FACE_IMAGES["S8"]!,
  "9": CARD_FACE_IMAGES["S9"]!,
  "10": CARD_FACE_IMAGES["S10"]!,
  J: CARD_FACE_IMAGES["SJ"]!,
  Q: CARD_FACE_IMAGES["SQ"]!,
  K: CARD_FACE_IMAGES["SK"]!,
};
