import { useEffect, useRef, useState, type ReactNode } from "react";
import { placeBet, readWallet, useWallet, type Bet } from "@/lib/wallet";

export type Pick = { label: string; odds: number };

const CHIPS = [1000, 5000, 10000, 25000, 50000, 100000, 200000, 500000];

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

/** Reads an odds cell out of any market board without touching every panel. */
function extractPick(target: HTMLElement, root: HTMLElement): Pick | null {
  // Never treat media / inputs / explicitly opted-out areas as a bet click.
  if (target.closest("iframe,video,img,input,textarea,select,a,[data-nobet]")) return null;

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
      return { label: side ? `${base} ${side}` : base, odds };
    }
  }
  return { label: side ? `Player ${side}` : "Selection", odds };
}




/** Red error toast used by the whole casino (insufficient balance, double bet…). */
export function ErrorToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2800);
    return () => window.clearTimeout(t);
  }, [message, onDone]);
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

function Stepper({
  value,
  onChange,
  step,
  decimals,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  decimals: number;
}) {
  const btn =
    "flex h-9 w-10 items-center justify-center rounded-[4px] text-[1.2rem] font-bold text-[#3B5A6B] disabled:opacity-40";
  return (
    <div className="flex items-center rounded-[4px] border border-[#c9d6de] bg-[#e6edf1]">
      <button type="button" className={btn} onClick={() => onChange(Math.max(0, value - step))}>
        −
      </button>
      <span className="flex-1 text-center text-[0.95rem] font-extrabold text-[#20384a]">
        {decimals ? value.toFixed(decimals) : String(Math.round(value)).padStart(2, "0")}
      </span>
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
  children,
}: {
  gameId: string;
  gameName: string;
  round: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [pick, setPick] = useState<Pick | null>(null);
  const [anchor, setAnchor] = useState(0);
  const [odds, setOdds] = useState(1);
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [err, setErr] = useState<string | null>(null);
  const busy = useRef(false);
  const wallet = useWallet();

  // Remember the last stake so the slip opens ready to bet in one tap.
  useEffect(() => {
    setStake(readLastStake());
  }, []);

  const close = () => {
    setPick(null);
  };


  const submit = () => {
    if (busy.current) {
      setErr("Do Not Place Bet At The Same Time.");
      return;
    }
    if (!pick) return;
    if (stake <= 0) {
      setErr("Please enter a valid stake.");
      return;
    }
    if (stake > readWallet().balance) {
      setErr("You have Insufficient Balance.");
      return;
    }
    busy.current = true;
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
    close();
  };

  return (
    <div
      className="relative"
      onClickCapture={(e) => {
        if (disabled) return;
        // Only a real pointer click on a price cell may open the slip.
        if (e.detail === 0) return;
        const root = e.currentTarget as HTMLElement;

        const target = e.target as HTMLElement;
        const p = extractPick(target, root);
        if (p) {
          // Anchor the slip right below the row that was clicked.
          let row: HTMLElement = target;
          const rootW = root.getBoundingClientRect().width;
          for (let i = 0; i < 8 && row.parentElement && row.parentElement !== root; i++) {
            if (row.getBoundingClientRect().width >= rootW * 0.8) break;
            row = row.parentElement;
          }
          const top = row.getBoundingClientRect().bottom - root.getBoundingClientRect().top;
          setAnchor(Math.max(0, top));
          setPick(p);
          setOdds(p.odds);
          setErr(null);
        }
      }}
    >
      {children}

      {err ? <ErrorToast message={err} onDone={() => setErr(null)} /> : null}

      {pick ? (
        <div
          className="absolute left-0 right-0 z-[70]"
          style={{ top: `${anchor}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[4px] border border-[#9fb6c4] bg-[linear-gradient(180deg,#cfe0ea_0%,#e9f1f5_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between bg-[#1f3b4d] px-3 py-2">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-white/80">
                {pick.label}
              </span>
              <span className="text-[0.78rem] font-extrabold text-white">
                Bal {Math.round(wallet.balance).toLocaleString("en-IN")}
              </span>
            </div>

            <div className="px-3 pb-3 pt-2">


              <div className="mt-2 grid grid-cols-2 gap-2">
                <Stepper value={odds} onChange={setOdds} step={0.01} decimals={2} />
                <Stepper value={stake} onChange={(v) => setStake(v)} step={100} decimals={0} />
              </div>

              <div className="mt-2 grid grid-cols-4 gap-2">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setStake((s) => s + c)}
                    className="h-9 rounded-[4px] border border-[#c9d6de] bg-white text-[0.78rem] font-bold text-[#20384a] active:bg-[#dfe9ef]"
                  >
                    {c.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between px-1 text-[0.75rem] font-bold text-[#4a6274]">
                <span>Stake {Math.round(stake).toLocaleString("en-IN")}</span>
                <span>Returns {Math.round(stake * odds).toLocaleString("en-IN")}</span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={close}
                  className="h-11 rounded-[4px] border border-[#c9d6de] bg-white text-[0.95rem] font-extrabold text-[#20384a]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={stake <= 0}
                  className="h-11 rounded-[4px] bg-[#2f7fbe] text-[0.95rem] font-extrabold text-white disabled:bg-[#b9c6ce] disabled:text-white/80"
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
