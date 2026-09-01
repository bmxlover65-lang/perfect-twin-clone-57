import { useState, type ReactNode } from "react";
import { placeBet, useWallet, type Bet } from "@/lib/wallet";

export type Pick = { label: string; odds: number };

const STAKES = [100, 500, 1000, 2000, 5000, 10000];

/** Reads an odds cell out of any market board without touching every panel. */
function extractPick(target: HTMLElement, root: HTMLElement): Pick | null {
  let el: HTMLElement | null = target;
  let odds: number | null = null;
  let node: HTMLElement | null = null;
  for (let i = 0; i < 4 && el && el !== root.parentElement; i++, el = el.parentElement) {
    const txt = (el.textContent ?? "").trim();
    if (txt.length > 16) continue;
    if (/suspend/i.test(txt)) return null;
    const m = txt.match(/^(\d{1,4}(?:\.\d{1,2})?)\b/);
    if (!m) continue;
    const v = Number(m[1]);
    if (v >= 1.01 && v <= 1000) {
      odds = v;
      node = el;
      break;
    }
  }
  if (odds == null || !node) return null;

  let row: HTMLElement | null = node.parentElement;
  for (let i = 0; i < 5 && row && row !== root.parentElement; i++, row = row.parentElement) {
    const txt = (row.textContent ?? "").replace(/\s+/g, " ").trim();
    const lab = txt.match(/[A-Za-z][A-Za-z0-9 .'&+-]{0,26}/);
    if (lab && lab[0].trim().length > 1) {
      return { label: lab[0].trim(), odds };
    }
  }
  return { label: "Selection", odds };
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
  const [stake, setStake] = useState(100);
  const [msg, setMsg] = useState<string | null>(null);
  const wallet = useWallet();

  return (
    <div
      onClickCapture={(e) => {
        if (disabled) return;
        const root = e.currentTarget as HTMLElement;
        const p = extractPick(e.target as HTMLElement, root);
        if (p) {
          setPick(p);
          setMsg(null);
        }
      }}
    >
      {children}

      {pick ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
          <div className="w-full max-w-[420px] rounded-[10px] bg-[#12233A] p-4 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white/60">
                  {gameName} · RID {round || "—"}
                </p>
                <p className="mt-1 text-[1.05rem] font-extrabold uppercase">{pick.label}</p>
              </div>
              <span className="rounded-[6px] bg-[#1B6FE0] px-3 py-1 text-[1rem] font-extrabold">
                {pick.odds.toFixed(2)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {STAKES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStake(s)}
                  className={`h-9 rounded-[6px] bg-[#1D3556] text-[0.85rem] font-extrabold ${
                    stake === s ? "ring-2 ring-[#F0A500]" : ""
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between text-[0.8rem] font-bold text-white/75">
              <span>Stake: {stake.toLocaleString("en-IN")}</span>
              <span>Returns: {Math.round(stake * pick.odds).toLocaleString("en-IN")}</span>
            </div>
            <p className="mt-1 text-[0.78rem] font-bold text-white/60">
              Balance: {Math.round(wallet.balance).toLocaleString("en-IN")}
            </p>
            {msg ? <p className="mt-1 text-[0.78rem] font-bold text-[#FF6B6B]">{msg}</p> : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPick(null)}
                className="h-10 rounded-[6px] bg-[#2A3F5C] text-[0.9rem] font-extrabold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const ok = placeBet({
                    gameId,
                    gameName,
                    round,
                    label: pick.label,
                    odds: pick.odds,
                    stake,
                  });
                  if (!ok) {
                    setMsg("Not enough balance");
                    return;
                  }
                  setPick(null);
                }}
                className="h-10 rounded-[6px] bg-[linear-gradient(180deg,#22C93A_0%,#0FA524_100%)] text-[0.9rem] font-extrabold"
              >
                Place bet
              </button>
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
