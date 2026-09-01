export interface SportDef {
  id: string;
  name: string;
}

export const SPORTS: SportDef[] = [
  { id: "4", name: "Cricket" },
  { id: "1", name: "Soccer" },
  { id: "2", name: "Tennis" },
  { id: "7", name: "Horse" },
  { id: "4339", name: "Greyhound" },
];

export interface EventDef {
  sportId: string;
  eventId: string;
  name: string;
  runners: string[];
  inPlay: boolean;
  score?: boolean;
  streaming?: boolean;
  base: number[];
  matched: number;
}

export const EVENTS: EventDef[] = [
  // Cricket — in-play
  {
    sportId: "4",
    eventId: "4002026831152437633",
    name: "Alleppey Ripples v Kochi Blue Tigers",
    runners: ["Alleppey Ripples", "Kochi Blue Tigers"],
    inPlay: true,
    score: true,
    streaming: true,
    base: [5.3, 1.22],
    matched: 212772,
  },
  {
    sportId: "4",
    eventId: "4002026831152437711",
    name: "England W v Ireland W",
    runners: ["England W", "Ireland W"],
    inPlay: true,
    score: true,
    streaming: true,
    base: [1.22, 5.3],
    matched: 4725160,
  },
  {
    sportId: "4",
    eventId: "4002026831152437790",
    name: "Glasgow Cosmic v Rotterdam Dockers",
    runners: ["Glasgow Cosmic", "Rotterdam Dockers"],
    inPlay: true,
    score: true,
    base: [3.45, 1.39],
    matched: 11905705,
  },
  {
    sportId: "4",
    eventId: "4002026831152437812",
    name: "Pakistan W v Thailand W",
    runners: ["Pakistan W", "Thailand W"],
    inPlay: true,
    score: true,
    base: [1.27, 4.4],
    matched: 533468,
  },
  {
    sportId: "4",
    eventId: "4002026831152437844",
    name: "Zimbabwe v South Africa",
    runners: ["Zimbabwe", "South Africa"],
    inPlay: true,
    score: true,
    streaming: true,
    base: [50, 1.01],
    matched: 32400142,
  },
  // Cricket — pre-match
  {
    sportId: "4",
    eventId: "4002026901152431001",
    name: "Belfast Wolves v Edinburgh Castle Rockers",
    runners: ["Edinburgh Castle Rockers", "Belfast Wolves"],
    inPlay: false,
    base: [0, 0],
    matched: 0,
  },
  {
    sportId: "4",
    eventId: "4002026901152431002",
    name: "Calicut Globstars v Aries Kollam Sailors",
    runners: ["Calicut Globstars", "Aries Kollam Sailors"],
    inPlay: false,
    base: [0, 0],
    matched: 0,
  },
  {
    sportId: "4",
    eventId: "4002026901152431003",
    name: "Caribbean Premier League - Winner",
    runners: [
      "Trinbago Knight Riders",
      "St Kitts & Nevis Patriots",
      "Barbados Royals",
    ],
    inPlay: false,
    base: [1.01, 1.01, 1.01],
    matched: 233,
  },
  {
    sportId: "4",
    eventId: "4002026901152431004",
    name: "Guyana Amazon Warriors v Jamaica Kingsmen",
    runners: ["Guyana Amazon Warriors", "Jamaica Kingsmen"],
    inPlay: false,
    base: [0, 0],
    matched: 0,
  },
  {
    sportId: "4",
    eventId: "4002026901152431005",
    name: "Kochi Blue Tigers v Trivandrum Royals",
    runners: ["Trivandrum Royals", "Kochi Blue Tigers"],
    inPlay: false,
    base: [0, 0],
    matched: 0,
  },
  {
    sportId: "4",
    eventId: "4002026901152431006",
    name: "St Kitts & Nevis Pats v Barbados Tridents",
    runners: ["Barbados Tridents", "St Kitts & Nevis Pats"],
    inPlay: false,
    base: [0, 0],
    matched: 0,
  },
  {
    sportId: "4",
    eventId: "4002026901152431007",
    name: "St Kitts & Nevis Pats v St. Lucia Kings",
    runners: ["St. Lucia Kings", "St Kitts & Nevis Pats"],
    inPlay: false,
    base: [0, 0],
    matched: 0,
  },
  {
    sportId: "4",
    eventId: "4002026901152431008",
    name: "Trinbago Knight Riders v Antigua & Barbuda Falcs",
    runners: ["Trinbago Knight Riders", "Antigua & Barbuda Falcs"],
    inPlay: false,
    base: [0, 0],
    matched: 0,
  },

  // Soccer
  {
    sportId: "1",
    eventId: "1002026831152110021",
    name: "Real Sporting v Atletico Norte",
    runners: ["Real Sporting", "Draw", "Atletico Norte"],
    inPlay: true,
    score: true,
    streaming: true,
    base: [1.72, 3.9, 5.4],
    matched: 1842366,
  },
  {
    sportId: "1",
    eventId: "1002026831152110022",
    name: "FC Kobenhavn v Malmo FF",
    runners: ["FC Kobenhavn", "Draw", "Malmo FF"],
    inPlay: true,
    score: true,
    base: [2.16, 3.3, 3.6],
    matched: 962104,
  },
  {
    sportId: "1",
    eventId: "1002026901152110023",
    name: "Bologna v Torino",
    runners: ["Bologna", "Draw", "Torino"],
    inPlay: false,
    base: [2.02, 3.35, 4.1],
    matched: 12450,
  },
  {
    sportId: "1",
    eventId: "1002026901152110024",
    name: "Sporting Lisbon v Braga",
    runners: ["Sporting Lisbon", "Draw", "Braga"],
    inPlay: false,
    base: [1.68, 3.9, 5.2],
    matched: 8830,
  },

  // Tennis
  {
    sportId: "2",
    eventId: "2002026831152220031",
    name: "R. Sharma v L. Novak",
    runners: ["R. Sharma", "L. Novak"],
    inPlay: true,
    score: true,
    streaming: true,
    base: [1.44, 2.82],
    matched: 402118,
  },
  {
    sportId: "2",
    eventId: "2002026901152220032",
    name: "A. Kowalski v M. Duarte",
    runners: ["A. Kowalski", "M. Duarte"],
    inPlay: false,
    base: [1.91, 1.95],
    matched: 5210,
  },

  // Horse
  {
    sportId: "7",
    eventId: "7002026831152770041",
    name: "Newcastle (GB) 18:45 5f Hcap",
    runners: ["Silver Arrow", "Night Runner", "Coastal Gold", "Bold Empire"],
    inPlay: false,
    base: [3.4, 4.8, 6.2, 9.4],
    matched: 74210,
  },
  {
    sportId: "7",
    eventId: "7002026831152770042",
    name: "Kempton (GB) 19:20 1m Mdn",
    runners: ["Quiet Storm", "Ivory Lane", "Red Marshal"],
    inPlay: false,
    base: [2.6, 3.9, 7.8],
    matched: 31984,
  },

  // Greyhound
  {
    sportId: "4339",
    eventId: "4339202683115433951",
    name: "Romford 18:32 A5 400m",
    runners: ["Trap 1", "Trap 2", "Trap 3", "Trap 4", "Trap 5", "Trap 6"],
    inPlay: false,
    base: [3.2, 4.4, 5.6, 6.8, 8.2, 11],
    matched: 9420,
  },
  {
    sportId: "4339",
    eventId: "4339202683115433952",
    name: "Sheffield 18:47 D3 500m",
    runners: ["Trap 1", "Trap 2", "Trap 3", "Trap 4", "Trap 5", "Trap 6"],
    inPlay: false,
    base: [2.9, 4.1, 5.2, 7.4, 9.6, 12.5],
    matched: 6110,
  },
];

export const sportName = (id: string) =>
  SPORTS.find((s) => s.id === id)?.name ?? "Sport";

export const findEvent = (sportId: string, eventId: string) =>
  EVENTS.find((e) => e.sportId === sportId && e.eventId === eventId);
