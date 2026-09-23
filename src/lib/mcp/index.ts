import { defineMcp } from "@lovable.dev/mcp-js";
import listCasinoGames from "./tools/list-casino-games";
import listSports from "./tools/list-sports";
import listMatches from "./tools/list-matches";
import getMatchOdds from "./tools/get-match-odds";

export default defineMcp({
  name: "universe-api",
  title: "Universe Api",
  version: "0.1.0",
  instructions:
    "Read-only public data from Universe Api. Use list_casino_games for casino tables, list_sports then list_matches then get_match_odds for live sports odds.",
  tools: [listCasinoGames, listSports, listMatches, getMatchOdds],
});
