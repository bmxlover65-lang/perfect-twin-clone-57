import cards32Img from "@/assets/games/32_cards.webp.asset.json";
import pokerImg from "@/assets/games/Poker.webp.asset.json";
import dtlImg from "@/assets/games/DTL.webp.asset.json";
import lucky7Img from "@/assets/games/Lucky-7.webp.asset.json";
import teenpatti1DayImg from "@/assets/games/1_Day_teenpatti.webp.asset.json";
import jokerTeenpattiImg from "@/assets/games/Joker_teenpatti.webp.asset.json";
import dragonTigerImg from "@/assets/games/dragon_tiger-01.webp.asset.json";
import baccaratImg from "@/assets/games/Baccarat.webp.asset.json";
import andarBaharImg from "@/assets/games/Andar_Bahar.webp.asset.json";
import dragonTiger1DayImg from "@/assets/games/1_Day_Dragon_tiger.webp.asset.json";
import muflisTeenpattiImg from "@/assets/games/muflisteenpatti-01.webp.asset.json";
import cardRaceImg from "@/assets/games/CardRace.webp.asset.json";
import teenpatti2020Img from "@/assets/games/20-20_teenpatti.webp.asset.json";

export type GameKind =
  | "teenpatti"
  | "dragontiger"
  | "baccarat"
  | "andarbahar"
  | "cards32"
  | "poker"
  | "lucky7"
  | "lucky09"
  | "wheel"
  | "coin"
  | "balloon"
  | "cardrace"
  | "ballbyball"
  | "dtl"
  | "aaa";

export interface GameMarketTemplate {
  /** Market title, e.g. "PAIR ( DUBBLE ) 1:4" */
  title: string;
  min: number;
  max: number;
  /** Selection labels, rendered left-to-right */
  runners: string[];
  /** Base decimal odds per runner */
  odds: number[];
}

export interface GameDef {
  id: string;
  name: string;
  kind: GameKind;
  /** Two hue stops used for the generated artwork */
  hues: [number, number];
  glyph: string;
  /** Optional cover artwork URL */
  image?: string | undefined;
  markets: GameMarketTemplate[];
  /** Result chip labels used in the Recent Result strip */
  results: string[];
}

const teenpattiMarkets = (): GameMarketTemplate[] => [
  {
    title: "WINNER",
    min: 100,
    max: 500000,
    runners: ["PLAYER A", "PLAYER B"],
    odds: [1.98, 1.98],
  },
  {
    title: "PAIR ( DUBBLE ) 1:4",
    min: 100,
    max: 100000,
    runners: ["PLAYER A ( PAIR )", "PLAYER B ( PAIR )"],
    odds: [4, 4],
  },
  {
    title: "FLUSH ( COLOR ) 1:8",
    min: 100,
    max: 100000,
    runners: ["PLAYER A ( FLUSH )", "PLAYER B ( FLUSH )"],
    odds: [8, 8],
  },
  {
    title: "STRAIGHT ( ROWN ) 1:14",
    min: 100,
    max: 100000,
    runners: ["PLAYER A ( STRAIGHT )", "PLAYER B ( STRAIGHT )"],
    odds: [14, 14],
  },
  {
    title: "STRAIGHT FLUSH ( PAKKI ROWN ) 1:40",
    min: 100,
    max: 100000,
    runners: ["PLAYER A ( STRAIGHT FLUSH )", "PLAYER B ( STRAIGHT FLUSH )"],
    odds: [40, 40],
  },
  {
    title: "TRIO ( TEEN ) 1:75",
    min: 100,
    max: 100000,
    runners: ["PLAYER A ( TRIO )", "PLAYER B ( TRIO )"],
    odds: [75, 75],
  },
  {
    title: "PUTLA 1 1:1.70",
    min: 100,
    max: 1000000,
    runners: ["PLAYER A ( PUTLA 1 )", "PLAYER B ( PUTLA 1 )"],
    odds: [1.7, 1.7],
  },
  {
    title: "PUTLA 2 1:4",
    min: 100,
    max: 1000000,
    runners: ["PLAYER A ( PUTLA 2 )", "PLAYER B ( PUTLA 2 )"],
    odds: [4, 4],
  },
  {
    title: "PUTLA 3 1:25",
    min: 100,
    max: 500000,
    runners: ["PLAYER A ( PUTLA 3 )", "PLAYER B ( PUTLA 3 )"],
    odds: [25, 25],
  },
  {
    title: "QUEEN & KING 1:25",
    min: 100,
    max: 500000,
    runners: ["PLAYER A ( QUEEN & KING )", "PLAYER B ( QUEEN & KING )"],
    odds: [25, 25],
  },
  {
    title: "JACK & QUEEN 1:25",
    min: 100,
    max: 500000,
    runners: ["PLAYER A ( JACK & QUEEN )", "PLAYER B ( JACK & QUEEN )"],
    odds: [25, 25],
  },
];

const dragonTigerMarkets = (): GameMarketTemplate[] => [
  {
    title: "WINNER",
    min: 100,
    max: 500000,
    runners: ["DRAGON", "TIE", "TIGER"],
    odds: [1.98, 9, 1.98],
  },
  {
    title: "PAIR 1:11",
    min: 100,
    max: 100000,
    runners: ["PAIR"],
    odds: [11],
  },
  {
    title: "DRAGON CARD",
    min: 100,
    max: 100000,
    runners: ["DRAGON EVEN", "DRAGON ODD", "DRAGON RED", "DRAGON BLACK"],
    odds: [2.12, 1.83, 1.97, 1.97],
  },
  {
    title: "TIGER CARD",
    min: 100,
    max: 100000,
    runners: ["TIGER EVEN", "TIGER ODD", "TIGER RED", "TIGER BLACK"],
    odds: [2.12, 1.83, 1.97, 1.97],
  },
];

const baccaratMarkets = (): GameMarketTemplate[] => [
  {
    title: "MAIN",
    min: 100,
    max: 500000,
    runners: ["PLAYER", "TIE", "BANKER"],
    odds: [2.0, 9.5, 1.95],
  },
  {
    title: "PAIRS 1:12",
    min: 100,
    max: 50000,
    runners: ["PLAYER PAIR", "BANKER PAIR"],
    odds: [12, 12],
  },
];

const andarBaharMarkets = (): GameMarketTemplate[] => [
  {
    title: "MAIN",
    min: 100,
    max: 500000,
    runners: ["ANDAR", "BAHAR"],
    odds: [1.98, 2.02],
  },
  {
    title: "FIRST CARD SUIT 1:3.5",
    min: 100,
    max: 50000,
    runners: ["SPADE", "HEART", "CLUB", "DIAMOND"],
    odds: [3.5, 3.5, 3.5, 3.5],
  },
];

const cards32Markets = (): GameMarketTemplate[] => [
  {
    title: "PLAYER TOTAL",
    min: 100,
    max: 300000,
    runners: ["PLAYER 8", "PLAYER 9", "PLAYER 10", "PLAYER 11"],
    odds: [3.6, 3.35, 3.35, 3.6],
  },
];

const pokerMarkets = (): GameMarketTemplate[] => [
  {
    title: "WINNER",
    min: 100,
    max: 500000,
    runners: ["PLAYER A", "PLAYER B"],
    odds: [1.98, 1.98],
  },
  {
    title: "BONUS 1:6",
    min: 100,
    max: 100000,
    runners: ["PLAYER A ( BONUS )", "PLAYER B ( BONUS )"],
    odds: [6, 6],
  },
];

const lucky7Markets = (): GameMarketTemplate[] => [
  {
    title: "MAIN",
    min: 100,
    max: 500000,
    runners: ["LOW CARD", "HIGH CARD"],
    odds: [1.98, 1.98],
  },
  {
    title: "SIDE BETS",
    min: 100,
    max: 100000,
    runners: ["EVEN", "ODD", "RED", "BLACK"],
    odds: [2.12, 1.83, 1.97, 1.97],
  },
];

const lucky09Markets = (): GameMarketTemplate[] => [
  {
    title: "NUMBER 1:9.5",
    min: 100,
    max: 100000,
    runners: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    odds: [9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5],
  },
  {
    title: "RANGE",
    min: 100,
    max: 300000,
    runners: ["LOW ( 0-4 )", "HIGH ( 5-9 )", "EVEN", "ODD"],
    odds: [1.96, 1.96, 1.96, 1.96],
  },
];

const wheelMarkets = (): GameMarketTemplate[] => [
  {
    title: "MULTIPLIER",
    min: 100,
    max: 200000,
    runners: ["1", "2", "5", "10", "20", "40"],
    odds: [1.9, 2.9, 5.8, 11, 21, 41],
  },
];

const coinMarkets = (): GameMarketTemplate[] => [
  {
    title: "MAIN",
    min: 100,
    max: 500000,
    runners: ["HEADS", "TAILS"],
    odds: [1.98, 1.98],
  },
];

const balloonMarkets = (): GameMarketTemplate[] => [
  {
    title: "COLOR",
    min: 100,
    max: 200000,
    runners: ["RED", "GREEN", "BLUE", "YELLOW"],
    odds: [3.8, 3.8, 3.8, 3.8],
  },
];

const cardRaceMarkets = (): GameMarketTemplate[] => [
  {
    title: "SUIT RACE 1:3.7",
    min: 100,
    max: 200000,
    runners: ["SPADE", "HEART", "CLUB", "DIAMOND"],
    odds: [3.7, 3.7, 3.7, 3.7],
  },
];

const ballByBallMarkets = (): GameMarketTemplate[] => [
  {
    title: "NEXT BALL",
    min: 100,
    max: 300000,
    runners: ["0", "1", "2", "4", "6", "WICKET"],
    odds: [2.4, 2.6, 6.5, 4.2, 6.0, 8.5],
  },
  {
    title: "OVER RUNS",
    min: 100,
    max: 200000,
    runners: ["UNDER 6.5", "OVER 6.5"],
    odds: [1.94, 1.94],
  },
];

const dtlMarkets = (): GameMarketTemplate[] => [
  {
    title: "WINNER",
    min: 100,
    max: 500000,
    runners: ["DRAGON", "TIGER", "LION"],
    odds: [2.9, 2.9, 2.9],
  },
];

const aaaMarkets = (): GameMarketTemplate[] => [
  {
    title: "WINNER",
    min: 100,
    max: 500000,
    runners: ["AMAR", "AKBAR", "ANTHONY"],
    odds: [2.9, 3.1, 2.9],
  },
  {
    title: "SIDE BETS",
    min: 100,
    max: 100000,
    runners: ["EVEN", "ODD", "RED", "BLACK"],
    odds: [2.12, 1.83, 1.97, 1.97],
  },
];

const marketsFor = (kind: GameKind): GameMarketTemplate[] => {
  switch (kind) {
    case "teenpatti":
      return teenpattiMarkets();
    case "dragontiger":
      return dragonTigerMarkets();
    case "baccarat":
      return baccaratMarkets();
    case "andarbahar":
      return andarBaharMarkets();
    case "cards32":
      return cards32Markets();
    case "poker":
      return pokerMarkets();
    case "lucky7":
      return lucky7Markets();
    case "lucky09":
      return lucky09Markets();
    case "wheel":
      return wheelMarkets();
    case "coin":
      return coinMarkets();
    case "balloon":
      return balloonMarkets();
    case "cardrace":
      return cardRaceMarkets();
    case "ballbyball":
      return ballByBallMarkets();
    case "dtl":
      return dtlMarkets();
    case "aaa":
      return aaaMarkets();
  }
};

interface Seed {
  id: string;
  name: string;
  kind: GameKind;
  hues: [number, number];
  glyph: string;
  results: string[];
}

const GAME_IMAGES: Record<string, string> = {
  "99.0022": cards32Img.url,
  "99.0007": pokerImg.url,
  "99.0041": dtlImg.url,
  "99.0030": lucky7Img.url,
  "99.0013": teenpatti1DayImg.url,
  "99.0010": teenpatti2020Img.url,
  "99.0014": muflisTeenpattiImg.url,
  "99.0046": cardRaceImg.url,
  "99.0016": jokerTeenpattiImg.url,
  "99.0018": dragonTigerImg.url,
  "99.0019": dragonTigerImg.url,
  "99.0021": dragonTiger1DayImg.url,
  "99.0001": baccaratImg.url,
  "99.0025": andarBaharImg.url,
};

const seeds: Seed[] = [
  { id: "4.3544687543453", name: "BALL BY BALL", kind: "ballbyball", hues: [140, 95], glyph: "⬤", results: ["0", "1", "2", "4", "6", "W"] },
  { id: "99.0010", name: "20-20 TEENPATTI", kind: "teenpatti", hues: [265, 320], glyph: "♠", results: ["A", "B"] },
  { id: "99.0030", name: "LUCKY 7", kind: "lucky7", hues: [35, 5], glyph: "7", results: ["L", "H"] },
  { id: "99.0013", name: "1DAY TEEN PATTI", kind: "teenpatti", hues: [215, 265], glyph: "♦", results: ["A", "B"] },
  { id: "99.0016", name: "JOKER TEEN PATTI", kind: "teenpatti", hues: [300, 190], glyph: "★", results: ["A", "B"] },
  { id: "99.0019", name: "20-20 DRAGON TIGER", kind: "dragontiger", hues: [10, 45], glyph: "DT", results: ["D", "T", "TIE"] },
  { id: "99.0001", name: "BACCARAT", kind: "baccarat", hues: [150, 200], glyph: "♣", results: ["P", "B", "T"] },
  { id: "99.0025", name: "ANDAR BAHAR", kind: "andarbahar", hues: [255, 200], glyph: "♥", results: ["A", "B"] },
  { id: "99.0022", name: "32 CARDS", kind: "cards32", hues: [190, 240], glyph: "32", results: ["8", "9", "10", "11"] },
  { id: "99.0007", name: "POKER", kind: "poker", hues: [225, 280], glyph: "♠", results: ["A", "B"] },
  { id: "99.0041", name: "DTL", kind: "dtl", hues: [20, 60], glyph: "DTL", results: ["D", "T", "L"] },
  { id: "99.0021", name: "1 DAY DRAGON TIGER", kind: "dragontiger", hues: [0, 40], glyph: "DT", results: ["D", "T", "TIE"] },
  { id: "99.0014", name: "MUFLIS TEEN PATTI", kind: "teenpatti", hues: [285, 240], glyph: "♣", results: ["A", "B"] },
  { id: "99.0046", name: "CARD RACE", kind: "cardrace", hues: [170, 215], glyph: "♦", results: ["♠", "♥", "♣", "♦"] },
  { id: "99.0005", name: "AMAR AKBAR ANTHONY", kind: "aaa", hues: [330, 275], glyph: "AAA", results: ["A", "K", "N"] },
  { id: "99.0018", name: "DRAGON TIGER", kind: "dragontiger", hues: [355, 25], glyph: "DT", results: ["D", "T", "TIE"] },
  { id: "88.0019", name: "LUCKY 0 TO 9", kind: "lucky09", hues: [250, 300], glyph: "09", results: ["0", "3", "5", "7", "9"] },
  { id: "88.0020", name: "DREAM CATCHER", kind: "wheel", hues: [200, 145], glyph: "◎", results: ["1", "2", "5", "10", "20", "40"] },
  { id: "88.0021", name: "HEADS & TAILS", kind: "coin", hues: [45, 20], glyph: "◐", results: ["H", "T"] },
  { id: "88.0023", name: "BALLOON", kind: "balloon", hues: [330, 20], glyph: "◍", results: ["R", "G", "B", "Y"] },
];

export const GAMES: GameDef[] = seeds.map((s) => ({
  ...s,
  image: GAME_IMAGES[s.id],
  markets: marketsFor(s.kind),
}));

export const getGame = (id: string): GameDef | undefined =>
  GAMES.find((g) => g.id === id);
