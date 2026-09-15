import { useEffect, useRef, useState, type ReactNode } from "react";
import { BET_ERR, placeBet, readWallet, useWallet, type Bet } from "@/lib/wallet";
import { playerSession } from "@/lib/player";
import { useEmbed } from "@/lib/embed";

export type Pick = { label: string; odds: number };
type ExtractedPick = Pick & { element: HTMLElement };

/** Quick-stake buttons in the bet slip — original site layout (4 × 2). */
const SLIP_CHIPS = [100, 200, 500, 5000, 10000, 25000, 50000, 100000];

const DEFAULT_STAKE = 1000;
const LAST_STAKE_KEY = "uapi.lastStake";

function readLastStake(): number {
  if (typeof window === "undefined") return DEFAULT_STAKE;
  const v = Number(window.localStorage.getItem(LAST_STAKE_KEY));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_STAKE;
}

function saveLastStake(v: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_STAKE_KEY, String(Math.round(v)));
}


const ODDS_RE = /^\d{1,4}(?:\.\d{1,2})?$/;

function oddsOf(el: Element): number | null {
  const own = (el.textContent ?? "").trim();
  const cands: string[] = [own];
  for (const c of Array.from(el.querySelectorAll("p,span,div,b,strong")).slice(0, 8)) {
    cands.push((c.textContent ?? "").trim());
  }
  for (const t of cands) {
    if (!ODDS_RE.test(t)) continue;
    const v = Number(t);
    if (v >= 1.01 && v <= 1000) return v;
  }
  return null;
}

/** True only for a compact, clickable-looking price cell. */
function isPriceCell(el: HTMLElement, root: HTMLElement): boolean {
  const own = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  // A price cell holds the odds and (at most) a tiny size line — never a whole row of copy.
  if (own.length > 18) return false;
  const r = el.getBoundingClientRect();
  const rootW = root.getBoundingClientRect().width || 1;
  if (r.width <= 0 || r.height <= 0) return false;
  if (r.width > rootW * 0.6) return false;
  if (r.height > 130) return false;
  return true;
}

/** Every SUSPENDED / CLOSED / LOCKED veil currently painted inside the board. */
function suspendVeils(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-suspended="true"]'))) {
    out.push(el);
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    if (el.children.length > 0) continue;
    const txt = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!txt || txt.length > 24) continue;
    if (!/^(suspend(ed)?|locked|closed|ball\s*running)$/i.test(txt)) continue;
    out.push(el.parentElement ?? el);
  }
  return out;
}

/**
 * True when a SUSPENDED / LOCKED / CLOSED banner (or a `data-suspended` block)
 * covers this price cell — those clicks must never open the bet slip.
 */
function isBlockedByOverlay(cell: HTMLElement, root: HTMLElement): boolean {
  const r = cell.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  let scope: HTMLElement | null = cell;
  for (let i = 0; i < 10 && scope && scope !== root.parentElement; i++, scope = scope.parentElement) {
    if (scope.getAttribute("data-suspended") === "true") return true;
    if (scope.getAttribute("aria-disabled") === "true") return true;
    if (scope instanceof HTMLButtonElement && scope.disabled) return true;
  }

  // Veils are often painted as absolute siblings far from the cell in the DOM,
  // so fall back to geometry: any veil box that covers the cell blocks it.
  for (const veil of suspendVeils(root)) {
    if (veil.contains(cell)) return true;
    const box = veil.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    if (cx >= box.left && cx <= box.right && cy >= box.top && cy <= box.bottom) return true;
  }
  return false;
}

/**
 * The market block a bet belongs to. Exposure figures net only inside this
 * block, so a bet on one market never changes the figures of another.
 */
function marketGroup(
  cell: HTMLElement,
  opposite: HTMLElement | undefined,
  root: HTMLElement,
): HTMLElement {
  // Smallest common block that holds both plates of the same market.
  if (opposite) {
    let a: HTMLElement | null = cell;
    for (let i = 0; i < 12 && a && a !== root.parentElement; i++, a = a.parentElement) {
      if (a.contains(opposite)) return a;
    }
  }
  return (
    cell.closest<HTMLElement>("[data-market-option]")
    ?? cell.closest<HTMLElement>("[data-runner-row]")?.parentElement
    ?? cell.parentElement
    ?? cell
  );
}

/**
 * Stable identity for a DOM node inside the board. The live feed re-renders
 * the market plates a few times per second, so holding element references
 * loses track of a selection — a positional key survives those re-renders and
 * keeps repeat bets on the same box adding up.
 */
function nodeKey(el: HTMLElement, root: HTMLElement): string {
  const parts: number[] = [];
  let n: HTMLElement | null = el;
  while (n && n !== root) {
    const p: HTMLElement | null = n.parentElement;
    if (!p) return "";
    parts.push(Array.prototype.indexOf.call(p.children, n));
    n = p;
  }
  return parts.reverse().join("-");
}

function nodeFromKey(key: string, root: HTMLElement): HTMLElement | null {
  if (!key) return null;
  let n: HTMLElement = root;
  for (const part of key.split("-")) {
    const child = n.children[Number(part)];
    if (!(child instanceof HTMLElement)) return null;
    n = child;
  }
  return n;
}



/** Reads an odds cell out of any market board without touching every panel. */

function extractPick(target: HTMLElement, root: HTMLElement): ExtractedPick | null {
  // Never treat media / inputs / explicitly opted-out areas as a bet click.
  if (target.closest("iframe,video,img,input,textarea,select,a,[data-nobet]")) return null;
  const control = target.closest("button");
  if (control && !control.hasAttribute("data-market-option")) return null;

  const explicit = target.closest<HTMLElement>("[data-bet-label][data-bet-odds]");
  if (explicit) {
    const explicitOdds = Number(explicit.getAttribute("data-bet-odds"));
    const explicitLabel = explicit.getAttribute("data-bet-label")?.trim();
    if (
      explicitLabel &&
      Number.isFinite(explicitOdds) &&
      explicitOdds >= 1.01 &&
      !isBlockedByOverlay(explicit, root)
    ) {
      return { label: explicitLabel, odds: explicitOdds, element: explicit };
    }
  }

  let el: HTMLElement | null = target;
  let odds: number | null = null;
  let node: HTMLElement | null = null;
  // Only the clicked element or its 2 closest wrappers can be the price cell —
  // anything further up is the row/board and must not open the slip.
  for (let i = 0; i < 3 && el && el !== root.parentElement; i++, el = el.parentElement) {
    if (/suspend|locked/i.test((el.textContent ?? "").trim())) return null;
    if (!isPriceCell(el, root)) continue;
    const v = oddsOf(el);
    if (v != null) {
      odds = v;
      node = el;
      break;
    }
  }
  if (odds == null || !node) return null;
  if (isBlockedByOverlay(node, root)) return null;



  // Side (A/B) from the cell's position when a row holds exactly two odds cells.
  let side = "";
  let cell: HTMLElement = node;
  for (let i = 0; i < 4 && cell.parentElement; i++, cell = cell.parentElement) {
    const sibs = Array.from(cell.parentElement.children).filter((c) => oddsOf(c) != null);
    if (sibs.length === 2) {
      side = sibs.indexOf(cell) === 0 ? "A" : "B";
      break;
    }
  }

  // Label = the nearest words-only text around the cell (market name / runner).
  let row: HTMLElement | null = node.parentElement;
  for (let i = 0; i < 6 && row && row !== root.parentElement; i++, row = row.parentElement) {
    const txt = (row.textContent ?? "").replace(/\s+/g, " ").trim();
    const lab = txt.match(/[A-Za-z]{3,}(?:[ '&+-][A-Za-z]{2,})*/);
    if (lab) {
      const base = lab[0].trim();
      return { label: side ? `${base} ${side}` : base, odds, element: node };
    }
  }
  return { label: side ? `Player ${side}` : "Selection", odds, element: node };
}




/** Red error toast used by the whole casino (insufficient balance, double bet…). */
export function ErrorToast({ message, onDone }: { message: string; onDone: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = window.setTimeout(() => doneRef.current(), 2500);
    return () => window.clearTimeout(t);
  }, [message]);
  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[80] w-[min(92vw,420px)] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-[4px] bg-[#C0392B] px-3 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-white">
          <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1 5h2v6h-2V7Zm0 8h2v2h-2v-2Z" />
        </svg>
        <span className="text-[0.82rem] font-semibold text-white">{message}</span>
      </div>
    </div>
  );
}

/** Green success toast shown after a bet is placed. */
export function SuccessToast({ message, onDone }: { message: string; onDone: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = window.setTimeout(() => doneRef.current(), 2200);
    return () => window.clearTimeout(t);
  }, [message]);
  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[80] w-[min(92vw,420px)] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-[4px] bg-[#28A745] px-3 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-white">
          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" />
        </svg>
        <span className="text-[0.82rem] font-semibold text-white">{message}</span>
      </div>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  step,
  decimals,
  editable = false,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  decimals: number;
  editable?: boolean;
  min?: number;
}) {
  const btn =
    "flex h-9 w-10 items-center justify-center rounded-[4px] text-[1.2rem] font-bold text-[#3B5A6B] disabled:opacity-40";
  return (
    <div className="flex items-center rounded-[4px] border border-[#c9d6de] bg-[#e6edf1]">
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      {editable ? (
        <input
          type="number"
          inputMode="numeric"
          min={min}
          step="1"
          value={value}
          aria-label="Bet amount"
          onChange={(event) => onChange(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
          onBlur={() => {
            if (value < min) onChange(min);
          }}
          className="h-9 min-w-0 flex-1 bg-transparent text-center text-[0.95rem] font-extrabold text-[#20384a] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      ) : (
        <span className="flex-1 text-center text-[0.95rem] font-extrabold text-[#20384a]">
          {decimals ? value.toFixed(decimals) : String(Math.round(value)).padStart(2, "0")}
        </span>
      )}
      <button type="button" className={btn} onClick={() => onChange(value + step)}>
        +
      </button>
    </div>
  );
}

/** Wrap any market board: clicking a price cell opens the bet slip. */
export function BetLayer({
  gameId,
  gameName,
  round,
  disabled,
  exposureLayout = "market",
  children,
}: {
  gameId: string;
  gameName: string;
  round: string;
  disabled?: boolean;
  exposureLayout?: "market" | "sports" | "row";
  children: ReactNode;
}) {
  const [pick, setPick] = useState<Pick | null>(null);
  const [anchor, setAnchor] = useState(0);
  const [odds, setOdds] = useState(1);
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Reference-style liability/profit figures shown directly below the market plates.
  const [chips, setChips] = useState<{
    id: number;
    /** Selection name — stable across live re-renders, unlike DOM position. */
    label: string;
    cellKey: string;
    oppositeKey?: string | undefined;
    /** Market block the bet belongs to — exposure nets inside this block only. */
    groupKey: string;
    amount: number;
    profit: number;
  }[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const slipRef = useRef<HTMLDivElement | null>(null);
  const openedPlate = useRef<HTMLElement | null>(null);
  const cellPos = useRef<{
    cell: HTMLElement;
    opposite?: HTMLElement | undefined;
    group: HTMLElement;
  } | null>(null);

  // Positions are re-measured from the live DOM so the figures stay glued to
  // their plates when the board reflows after a bet.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!chips.length) return;
    const bump = () => setTick((t) => t + 1);
    const ro = new ResizeObserver(bump);
    if (rootRef.current) ro.observe(rootRef.current);
    window.addEventListener("resize", bump);
    window.addEventListener("scroll", bump, true);
    const id = window.setInterval(bump, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", bump);
      window.removeEventListener("scroll", bump, true);
      window.clearInterval(id);
    };
  }, [chips.length]);
  const busy = useRef(false);
  const pickRound = useRef("");
  // Once a market shows SUSPENDED / CLOSED in a round, that market stays
  // blocked for the rest of the round. Only the affected market is latched —
  // other markets on the same table stay open (side markets suspend early).
  const latched = useRef<HTMLElement[]>([]);
  const roundChangedAt = useRef(0);

  const wallet = useWallet();
  const embed = useEmbed();

  /** True when the cell sits inside a market latched as suspended this round. */
  const inLatchedMarket = (cell: HTMLElement) =>
    latched.current.some((m) => m.isConnected && m.contains(cell));

  // Remember the last stake so the slip opens ready to bet in one tap.
  useEffect(() => {
    setStake(readLastStake());
  }, []);

  useEffect(() => {
    setChips([]);
    openedPlate.current?.style.removeProperty("margin-bottom");
    openedPlate.current = null;
    latched.current = []; // new round → every market opens again
    roundChangedAt.current = Date.now();
    rootRef.current
      ?.querySelectorAll<HTMLElement>('[data-has-exposure="true"]')
      .forEach((element) => element.removeAttribute("data-has-exposure"));
  }, [round]);

  // Watch the board: the moment a SUSPENDED / CLOSED / BALL RUNNING banner
  // appears over a market, latch that market for the rest of the round.
  useEffect(() => {
    const id = window.setInterval(() => {
      const root = rootRef.current;
      if (!root) return;
      // Grace window: a closing veil from the previous round may still be
      // visible for a moment right after the new round starts.
      if (Date.now() - roundChangedAt.current < 1200) return;

      const flags: HTMLElement[] = [
        ...Array.from(root.querySelectorAll<HTMLElement>('[data-suspended="true"]')),
        ...Array.from(root.querySelectorAll<HTMLElement>("*")).filter((el) => {
          if (el.children.length > 0) return false;
          const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
          return /^(suspend(ed)?|locked|closed|ball\s*running)$/i.test(t);
        }),
      ];

      for (const flag of flags) {
        // A selection that carries its own live lock flag needs no latch: the
        // attribute itself says whether it is open right now, and latching it
        // would keep it blocked after the board re-opens it.
        if (flag.matches("[data-market-option]")) continue;
        // Latch the market block that the banner covers, not the whole table.
        let market: HTMLElement = flag;
        for (let i = 0; i < 4 && market.parentElement && market.parentElement !== root; i++) {
          market = market.parentElement;
          if (market.querySelector("[data-market-option],[data-runner-row]")) break;
        }
        if (!latched.current.includes(market)) latched.current.push(market);
      }

      const cellEl = cellPos.current?.cell;
      if (cellEl && (inLatchedMarket(cellEl) || isBlockedByOverlay(cellEl, root))) {
        setPick(null);
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [round]);


  // The operator wallet can refuse an integrated bet after it was sent.
  useEffect(() => {
    const onErr = (e: Event) => setErr((e as CustomEvent<string>).detail);
    window.addEventListener(BET_ERR, onErr);
    return () => window.removeEventListener(BET_ERR, onErr);
  }, []);

  const close = () => {
    openedPlate.current?.style.removeProperty("margin-bottom");
    openedPlate.current = null;
    setPick(null);
  };

  // Ball by Ball and Heads & Tails use two-column grids. Expanding the clicked
  // plate's row reserves real space for the slip, so every later row stays
  // visible instead of being covered by the absolute-positioned panel.
  useEffect(() => {
    const plate = openedPlate.current;
    const slip = slipRef.current;
    if (!pick || !plate || !slip || !plate.matches(".bbb-rate-plate,.coin-bet-plate")) return;
    const size = () => plate.style.setProperty("margin-bottom", `${slip.offsetHeight}px`);
    size();
    const observer = new ResizeObserver(size);
    observer.observe(slip);
    return () => observer.disconnect();
  }, [pick]);

  // Watch the clicked cell while the slip is open: the moment it gets a
  // SUSPENDED / locked overlay, the slip closes so no bet can be confirmed.
  useEffect(() => {
    if (!pick) return;
    const id = window.setInterval(() => {
      const rootEl = rootRef.current;
      const cellEl = cellPos.current?.cell;
      if (!rootEl || !cellEl) return;
      if (!cellEl.isConnected || isBlockedByOverlay(cellEl, rootEl)) {
        setPick(null);
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [pick]);



  const submit = () => {
    if (busy.current) {
      setErr("Do Not Place Bet At The Same Time.");
      return;
    }
    if (!pick) return;
    const pickLabel = pick.label;

    // The market can suspend (or the round can roll over) while the slip is
    // open — a pre-filled stake must never sneak through after that.
    if (pickRound.current !== round) {
      setErr("Bet Closed. Round Changed.");
      close();
      return;
    }
    if (cellPos.current?.cell && inLatchedMarket(cellPos.current.cell)) {
      close();
      return;
    }

    const rootEl = rootRef.current;
    const cellEl = cellPos.current?.cell;
    if (rootEl && cellEl && isBlockedByOverlay(cellEl, rootEl)) {
      close();
      return;
    }

    if (stake < 100) {
      setErr("Minimum bet is 100.");
      return;
    }
    if (!playerSession() && stake > readWallet().balance) {
      setErr("You have Insufficient Balance.");
      return;
    }
    busy.current = true;
    saveLastStake(stake);
    const ok = placeBet({
      gameId,
      gameName,
      round,
      label: pick.label,
      odds,
      stake,
    });
    window.setTimeout(() => {
      busy.current = false;
    }, 600);
    if (!ok) {
      setErr("You have Insufficient Balance.");
      return;
    }
    const pos = cellPos.current;
    close();
    if (pos && rootEl) {
      const markExposure = (element: HTMLElement) => {
        const plate = element.closest<HTMLElement>("[data-market-plate]")
          ?? element.querySelector<HTMLElement>("[data-market-plate]")
          ?? element;
        plate.setAttribute("data-has-exposure", "true");
      };
      markExposure(pos.cell);
      if (pos.opposite) markExposure(pos.opposite);
      const cellKey = nodeKey(pos.cell, rootEl);
      const oppositeKey = pos.opposite ? nodeKey(pos.opposite, rootEl) : undefined;
      const groupKey = nodeKey(pos.group, rootEl);
      // Same selection bet again in the same round → one chip with the total.
      // Identity is market + selection name: the live feed keeps re-rendering
      // the plates, so a DOM position alone would create a second chip and
      // double the figures on the board.
      const label = pick.label;
      setChips((cur) => {
        const i = cur.findIndex((c) => c.groupKey === groupKey && c.label === label);
        if (i < 0) {
          return [
            ...cur,
            {
              id: Date.now(),
              label,
              cellKey,
              oppositeKey,
              groupKey,
              amount: stake,
              profit: stake * Math.max(0, odds - 1),
            },

          ];
        }
        const next = [...cur];
        const current = next[i];
        if (!current) return cur;
        next[i] = {
          ...current,
          cellKey,
          oppositeKey: oppositeKey ?? current.oppositeKey,
          amount: current.amount + stake,
          profit: current.profit + stake * Math.max(0, odds - 1),
        };
        return next;
      });
    }

    setSuccess(`Bet Placed · ${pickLabel} @ ${odds} · ${Math.round(stake)}`);

  };

  return (
    <div
      ref={rootRef}
      data-bet-root=""
      className="relative"
      onClickCapture={(e) => {
        if (disabled) return;
        // Only a real pointer click on a price cell may open the slip.
        if (e.detail === 0) return;
        const root = e.currentTarget as HTMLElement;
        // This market was suspended — no new bets on it until the next round.
        if (inLatchedMarket(e.target as HTMLElement)) {
          return;
        }


        const target = e.target as HTMLElement;
        const p = extractPick(target, root);
        if (p) {
          const rootBox = root.getBoundingClientRect();
          // Mobile boards are scaled down with a transform: rect coords are visual
          // pixels, but absolutely-positioned chips use unscaled layout units.
          const scale = rootBox.width / (root.offsetWidth || rootBox.width) || 1;
          const u = (v: number) => v / scale;
          let cellEl: HTMLElement = p.element;
          let oppositeEl: HTMLElement | undefined;

          if (exposureLayout === "sports" || exposureLayout === "row") {
            const runnerRow = p.element.closest<HTMLElement>("[data-runner-row]");
            const board = runnerRow?.parentElement;
            const opponent = board
              ? Array.from(board.querySelectorAll<HTMLElement>("[data-runner-row]")).find(
                  (candidate) => candidate !== runnerRow,
                )
              : undefined;
            if (exposureLayout === "row") {
              const nameOf = (row?: HTMLElement | null) =>
                row?.querySelector<HTMLElement>("[data-runner-name]") ?? row ?? undefined;
              if (runnerRow) cellEl = nameOf(runnerRow) ?? runnerRow;
              oppositeEl = nameOf(opponent);
            } else {
              if (runnerRow) cellEl = runnerRow;
              if (opponent) oppositeEl = opponent;
            }
          }


          if (exposureLayout === "market") {
            let pairNode: HTMLElement = p.element;
            for (let i = 0; i < 4 && pairNode.parentElement; i++, pairNode = pairNode.parentElement) {
              const priceCells = Array.from(pairNode.parentElement.children).filter(
                (child): child is HTMLElement =>
                  child instanceof HTMLElement && isPriceCell(child, root) && oddsOf(child) != null,
              );
              if (priceCells.length !== 2) continue;
              const currentIndex = priceCells.findIndex((c) => c === pairNode || c.contains(p.element));
              const opposite = currentIndex === 0 ? priceCells[1] : currentIndex === 1 ? priceCells[0] : undefined;
              if (!opposite) continue;
              oppositeEl = opposite;
              break;

            }
            if (!oppositeEl) {
              // Some boards nest the two plates deeper: look for a block holding
              // exactly two price plates and take the other one.
              let block: HTMLElement | null = p.element.parentElement;
              for (let i = 0; i < 6 && block && block !== root; i++, block = block.parentElement) {
                const all = Array.from(block.querySelectorAll<HTMLElement>("*")).filter(
                  (el) => isPriceCell(el, root) && oddsOf(el) != null,
                );
                // Keep only the outermost plate of each nested group.
                const cells = all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
                if (cells.length === 2) {
                  oppositeEl = cells.find((el) => !el.contains(p.element) && !p.element.contains(el));
                  if (oppositeEl) break;
                }
              }
            }

          }

          // Exposure only nets inside the market the bet belongs to, never
          // across the whole table (that produced wrong figures on the plates).
          const groupEl = marketGroup(cellEl, oppositeEl, root);
          cellPos.current = { cell: cellEl, opposite: oppositeEl, group: groupEl };


          // Open directly below the clicked rate box. Previously this climbed
          // to a wide board wrapper, which could put the slip below the whole
          // market instead of beneath the selected row.
          const clickedPlate = p.element.closest<HTMLElement>("[data-market-option]") ?? p.element;
          openedPlate.current?.style.removeProperty("margin-bottom");
          openedPlate.current = clickedPlate;
          const top = u(clickedPlate.getBoundingClientRect().bottom - rootBox.top);
          setAnchor(Math.max(0, top));
          pickRound.current = round;
          setPick({ label: p.label, odds: p.odds });
          setOdds(p.odds);
          setStake(0);
          setErr(null);
        }
      }}
    >
      {children}

      {(() => {
        const root = rootRef.current;
        if (!root || !chips.length) return null;
        const rootBox = root.getBoundingClientRect();
        const scale = rootBox.width / (root.offsetWidth || rootBox.width) || 1;
        const at = (el: HTMLElement) => {
          if (exposureLayout === "sports") {
            const b = el.getBoundingClientRect();
            return { x: (b.left - rootBox.left) / scale + 10, y: (b.top - rootBox.top) / scale + 35 };
          }
          if (exposureLayout === "row") {
            const b = el.getBoundingClientRect();
            return { x: (b.left - rootBox.left) / scale, y: (b.bottom - rootBox.top) / scale + 3 };
          }
          // Anchor to the visible rate plate, not the inner odds text.
          const plate = el.querySelector<HTMLElement>('[class*="casino-market-rate"]')
            ?? el.closest<HTMLElement>('[class*="casino-market-rate"]')
            ?? el;
          const b = plate.getBoundingClientRect();
          return {
            x: (b.left + b.width / 2 - rootBox.left) / scale,
            y: (b.bottom - rootBox.top) / scale + 7,
          };
        };

        const decimals = exposureLayout === "market" ? 0 : 2;

        // Bets on several selections of the SAME market net out: every
        // selection shows one figure — its own profit minus the stakes
        // riding on the other selections of that market only.
        // One figure per plate. Two chips can resolve to the same plate after a
        // live re-render — dedupe on the resolved element so the numbers never
        // print on top of each other.
        const used = new Set<HTMLElement>();
        const cells: { el: HTMLElement; groupKey: string; label: string | null }[] = [];
        const push = (key: string | undefined, groupKey: string, label: string | null) => {
          if (!key) return;
          const el = nodeFromKey(key, root);
          if (!el || !el.isConnected || used.has(el)) return;
          used.add(el);
          cells.push({ el, groupKey, label });
        };
        chips.forEach((c) => push(c.cellKey, c.groupKey, c.label));
        chips.forEach((c) => push(c.oppositeKey, c.groupKey, null));

        const own = (groupKey: string, label: string | null) =>
          label === null
            ? []
            : chips.filter((c) => c.groupKey === groupKey && c.label === label);
        const groupStakeOf = (groupKey: string) =>
          chips.filter((c) => c.groupKey === groupKey).reduce((s, c) => s + c.amount, 0);

        return cells.map(({ el, groupKey, label }, i) => {
          const mine = own(groupKey, label);
          const stakeOwn = mine.reduce((s, c) => s + c.amount, 0);
          const profitOwn = mine.reduce((s, c) => s + c.profit, 0);
          const net = profitOwn - (groupStakeOf(groupKey) - stakeOwn);
          const value = exposureLayout === "market" ? Math.round(net) : net;
          const pos = at(el);


          const market = exposureLayout === "market";
          return (
            <span
              key={`exp-${i}`}
              className={`pointer-events-none absolute z-[60] whitespace-nowrap font-semibold leading-none text-casino-market-text ${
                market
                  ? "-translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85 px-1.5 py-[2px] text-[0.62rem] shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                  : "text-[0.78rem]"
              }`}
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            >
              {exposureLayout === "sports" ? null : `${net >= 0 ? "P" : "L"}:`}
              <strong className={net >= 0 ? "text-live-win" : "text-live-lose"}>
                {exposureLayout === "sports" ? "➜ " : null}
                {value.toLocaleString("en-IN", {
                  minimumFractionDigits: decimals,
                  maximumFractionDigits: decimals,
                })}
              </strong>
            </span>
          );
        });
      })()}



      {err ? <ErrorToast message={err} onDone={() => setErr(null)} /> : null}
      {success ? <SuccessToast message={success} onDone={() => setSuccess(null)} /> : null}


      {pick ? (
        <div
          ref={slipRef}
          data-nobet=""
          className="absolute left-0 right-0 z-[70]"
          style={{ top: `${anchor}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto w-full max-w-[430px] overflow-hidden border-y border-[#a8c1d2] bg-[#d8efd5] shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
            {embed ? null : (
              <div className="flex items-center justify-between bg-[#1f3b4d] px-3 py-1.5">
                <span className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-white/80">
                  {pick.label}
                </span>
                <span className="text-[0.78rem] font-extrabold text-white">
                  Bal {Math.round(wallet.balance).toLocaleString("en-IN")}
                </span>
              </div>
            )}

            <div className="px-1 pb-2 pt-2">
              <div className="grid grid-cols-2 gap-1.5">
                <Stepper value={odds} onChange={setOdds} step={0.01} decimals={2} />
                <Stepper value={stake} onChange={setStake} step={100} decimals={0} editable min={100} />
              </div>

              <div className="mt-2 grid grid-cols-4 gap-2">
                {SLIP_CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setStake(c);
                      saveLastStake(c);
                    }}
                    className={`h-[31px] rounded-[4px] border text-[0.88rem] font-medium active:bg-[#eef4f8] ${
                      Math.round(stake) === c
                        ? "border-[#2f7fbe] bg-[#2f7fbe] text-white"
                        : "border-[#c3d3de] bg-white text-[#1d2c36]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="h-[38px] rounded-[4px] border border-[#55606a] bg-white text-[0.98rem] font-bold text-[#1d2c36]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={stake < 100}
                  className="h-[38px] rounded-[4px] bg-[#2f7fbe] text-[0.98rem] font-bold text-white disabled:bg-[#5d695f] disabled:text-white/85"
                >
                  Place Bet
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BalanceChip() {
  const wallet = useWallet();
  const embed = useEmbed();
  if (embed) return null;
  return (
    <span className="rounded-full bg-[#123A73] px-3 py-1 text-[0.8rem] font-extrabold text-white">
      Bal {Math.round(wallet.balance).toLocaleString("en-IN")}
    </span>
  );
}

export function MyBets({ gameId }: { gameId: string }) {
  const wallet = useWallet();
  const rows: Bet[] = wallet.bets.filter((b) => b.gameId === gameId).slice(0, 12);
  if (!rows.length) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-md bg-ex-panel">
      <p className="bg-[#2E4B5C] px-3 py-2 text-[0.85rem] font-bold uppercase text-white">
        My bets
      </p>
      <table className="w-full text-[0.8rem]">
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-b border-black/10 last:border-0">
              <td className="px-3 py-2 font-bold text-ex-text">{b.label}</td>
              <td className="px-2 py-2 text-ex-text/80">{b.odds.toFixed(2)}</td>
              <td className="px-2 py-2 text-ex-text/80">{b.stake.toLocaleString("en-IN")}</td>
              <td className="px-3 py-2 text-right font-extrabold">
                {b.status === "open" ? (
                  <span className="text-[#E8871E]">OPEN</span>
                ) : b.status === "won" ? (
                  <span className="text-[#1F9D45]">+{b.payout.toLocaleString("en-IN")}</span>
                ) : b.status === "void" ? (
                  <span className="text-[#8A93A6]">VOID ↩ {b.stake.toLocaleString("en-IN")}</span>
                ) : (
                  <span className="text-[#C93A3A]">-{b.stake.toLocaleString("en-IN")}</span>
                )}

              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
