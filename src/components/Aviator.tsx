import { useEmbed } from "@/lib/embed";
import { useCallback, useEffect, useRef, useState } from "react";
import aviatorPlane from "@/assets/aviator/plane-0.svg";
import historyIcon from "@/assets/aviator/history.svg";
import arrowIcon from "@/assets/aviator/arrow-down.svg";
import fairIcon from "@/assets/aviator/provably-fair.svg";
import propellerImg from "@/assets/aviator/propeller.png.asset.json";
import av1 from "@/assets/aviator/av1.png";
import av2 from "@/assets/aviator/av2.png";
import av3 from "@/assets/aviator/av3.png";
import av4 from "@/assets/aviator/av4.png";
import av5 from "@/assets/aviator/av5.png";
import av6 from "@/assets/aviator/av6.png";
import bgSound from "@/assets/aviator/aviator-background.mp3.asset.json";
import crashSound from "@/assets/aviator/plane-crash.mp3.asset.json";
import beepSound from "@/assets/aviator/beep.mp3.asset.json";
import winSound from "@/assets/aviator/win.mp3.asset.json";

import { type AviatorControl, useAdminConfig } from "@/lib/admin";
import { playerSession, remoteBet, remoteCashout, remoteSettle } from "@/lib/player";
import { logBet, setBalance as saveBalance } from "@/lib/telemetry";

const AVATARS = [av1, av2, av3, av4, av5, av6];

/* ---------------- round engine ---------------- */

type Phase = "betting" | "flying" | "crashed";

const BET_MS = 8000;



function fmt(n: number) {
  return n.toFixed(2);
}

function chipTone(m: number) {
  if (m < 2) return "text-[#20BFFF]";
  if (m < 10) return "text-[#8B5CF6]";
  return "text-[#FF2DAA]";
}

function HistToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label="Round history"
      className="flex h-[20px] w-[34px] shrink-0 items-center justify-center gap-[3px] rounded-full border border-[#4A4D52] bg-[#1B1C1F] shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
    >
      <img src={historyIcon} alt="" className="h-[12px] w-[13px]" />
      <img
        src={arrowIcon}
        alt=""
        className={`h-[6px] w-[8px] transition-transform ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}



/* ---------------- live bets (real players only) ---------------- */

type LiveBet = {
  id: number;
  user: string;
  amount: number;
  cashedAt?: number;
  busted?: boolean;
  bal: number;
  target: number;
};

function maskName(n: string) {
  const s = n.replace(/\s+/g, "").toLowerCase();
  if (s.length < 3) return s;
  return `${s[0]}${"*".repeat(Math.max(3, Math.min(7, s.length - 2)))}${s[s.length - 1]}`;
}



/* ---------------- bet panel ---------------- */

type PanelState = {
  amount: number;
  staged: boolean; // queued for next round
  active: boolean; // in play this round
  cashedAt: number | null;
  mode: "bet" | "auto";
  auto: boolean;
  autoCashout: number;
};

const initialPanel = (amount: number): PanelState => ({
  amount,
  staged: false,
  active: false,
  cashedAt: null,
  mode: "bet",
  auto: false,
  autoCashout: 1.1,
});

/** Small Bet | Auto pill toggle shown at the top of every bet panel. */
function PanelModeTabs({
  state,
  setState,
}: {
  state: PanelState;
  setState: (fn: (p: PanelState) => PanelState) => void;
}) {
  return (
    <div className="flex w-[110px] rounded-full bg-[#0B0C0E] p-[3px] text-[0.62rem] font-bold uppercase tracking-wide text-white/55">
      {(["bet", "auto"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setState((p) => ({ ...p, mode: m }))}
          className={`flex-1 rounded-full py-[3px] capitalize ${
            state.mode === m ? "bg-[#2C2D30] text-white" : ""
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

const QUICK = [100, 200, 500, 1000];

/** Stake stepper + quick chips, exactly like the original Aviator panel. */
function StakeControl({
  state,
  setState,
  locked,
  big,
}: {
  state: PanelState;
  setState: (fn: (p: PanelState) => PanelState) => void;
  locked: boolean;
  big?: boolean;
}) {
  const step = (d: number) =>
    setState((p) => ({ ...p, amount: Math.max(10, Math.round((p.amount + d) * 100) / 100) }));
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
      <div className="flex items-center justify-between rounded-full bg-[#0B0C0E] px-1 py-[3px]">
        <button
          type="button"
          disabled={locked}
          onClick={() => step(-10)}
          className="h-[22px] w-[22px] shrink-0 rounded-full bg-[#2A2C30] text-[0.95rem] leading-none text-white/70 disabled:opacity-40"
        >
          −
        </button>
        <span
          className={`min-w-0 flex-1 text-center font-bold text-white ${big ? "text-[1rem]" : "text-[0.85rem]"}`}
        >
          {state.amount.toFixed(2)}
        </span>
        <button
          type="button"
          disabled={locked}
          onClick={() => step(10)}
          className="h-[22px] w-[22px] shrink-0 rounded-full bg-[#2A2C30] text-[0.95rem] leading-none text-white/70 disabled:opacity-40"
        >
          +
        </button>
      </div>
      <div className="grid grid-cols-2 gap-[6px]">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            disabled={locked}
            onClick={() => setState((p) => ({ ...p, amount: q }))}
            className={`rounded-full border bg-[#151618] text-center font-semibold disabled:opacity-40 ${
              big ? "py-[7px] text-[0.8rem]" : "py-[5px] text-[0.72rem]"
            } ${state.amount === q ? "border-[#16C800] text-white" : "border-[#44474D] text-[#C9CBD1]"}`}
          >
            {q.toFixed(2)}
          </button>
        ))}
      </div>
    </div>
  );
}

function BetPanel({
  state,
  setState,
  phase,
  multiplier,
  onWin,
  balance,
}: {
  state: PanelState;
  setState: (fn: (p: PanelState) => PanelState) => void;
  phase: Phase;
  multiplier: number;
  onWin: (amount: number) => void;
  balance: number;
}) {
  const canCash = phase === "flying" && state.active && state.cashedAt === null;
  const pending = state.staged || (state.active && state.cashedAt === null);

  const tone = canCash
    ? "bg-[#F59E0B] hover:bg-[#f8ac2b]"
    : pending
      ? "bg-[#EF0000] hover:bg-[#ff1717]"
      : "bg-[#18C800] hover:bg-[#1ed100]";

  const press = () => {
    if (canCash) {
      const win = state.amount * multiplier;
      onWin(win);
      setState((p) => ({ ...p, cashedAt: multiplier }));
      return;
    }
    if (pending) {
      setState((p) => ({ ...p, staged: false, active: false }));
      return;
    }
    // One bet per round: the round must finish before betting again.
    if (state.active && phase !== "betting") return;
    if (state.amount > balance) return;
    setState((p) => ({ ...p, staged: true, cashedAt: null }));
  };

  return (
    <div className="flex min-w-0 flex-col gap-[6px]">
      <PanelModeTabs state={state} setState={setState} />
      <div className="flex min-w-0 items-stretch gap-[8px]">
        <button
          type="button"
          onClick={press}
          className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-[14px] px-2 py-[10px] text-white shadow-[0_1px_0_rgba(0,0,0,0.4)] ${tone}`}
        >
          <span className="text-[0.9rem] font-black uppercase leading-tight">
            {canCash ? "Cash Out" : pending ? "Cancel" : "Bet"}
          </span>
          <span className="text-[0.72rem] font-bold leading-tight">
            {canCash
              ? `${fmt(state.amount * multiplier)} INR`
              : `${state.amount.toFixed(2)} INR`}
          </span>
        </button>
        <StakeControl state={state} setState={setState} locked={pending || canCash} />
      </div>

      {state.mode === "auto" ? (
        <div className="flex items-center gap-[6px]">
          <button
            type="button"
            onClick={() => setState((p) => ({ ...p, auto: !p.auto }))}
            aria-pressed={state.auto}
            className={`relative h-[20px] w-[40px] shrink-0 rounded-full transition-colors ${
              state.auto ? "bg-[#18B800]" : "bg-[#2A2C30]"
            }`}
          >
            <span
              className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-all ${
                state.auto ? "left-[22px]" : "left-[2px]"
              }`}
            />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-[#0B0C0E] px-3 py-[3px]">
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={state.autoCashout}
              onChange={(e) => {
                const v = Number(e.target.value);
                setState((p) => ({ ...p, autoCashout: Number.isFinite(v) ? v : p.autoCashout }));
              }}
              className="min-w-0 flex-1 bg-transparent text-center text-[0.78rem] font-bold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setState((p) => ({ ...p, autoCashout: 1.1, auto: false }))}
              aria-label="Clear auto cashout"
              className="shrink-0 text-[0.8rem] leading-none text-white/45 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {state.cashedAt ? (
        <p className="text-center text-[0.62rem] font-bold text-[#18B800]">
          {fmt(state.cashedAt)}x · {fmt(state.amount * state.cashedAt)}
        </p>
      ) : state.staged ? (
        <p className="text-center text-[0.62rem] font-semibold text-[#9CA3AF]">
          Waiting for next round
        </p>
      ) : null}
    </div>
  );
}


const MOBILE_PRESETS = [10, 50, 100, 500, 1000, 2500, 5000, 10000];

/** Mobile slot: Auto toggle + compact preset grid + Cash In (matches mobile reference). */
function MobileBetSlot({
  state,
  setState,
  phase,
  multiplier,
  onWin,
  balance,
}: {
  state: PanelState;
  setState: (fn: (p: PanelState) => PanelState) => void;
  phase: Phase;
  multiplier: number;
  onWin: (amount: number) => void;
  balance: number;
}) {
  const canCash = phase === "flying" && state.active && state.cashedAt === null;
  const pending = state.staged || (state.active && state.cashedAt === null);
  const locked = pending || canCash;
  const tone = canCash ? "bg-[#F59E0B]" : pending ? "bg-[#EF0000]" : "bg-[#16A62A]";

  const press = () => {
    if (canCash) {
      onWin(state.amount * multiplier);
      setState((p) => ({ ...p, cashedAt: multiplier }));
      return;
    }
    if (pending) {
      setState((p) => ({ ...p, staged: false, active: false }));
      return;
    }
    // One bet per round: the round must finish before betting again.
    if (state.active && phase !== "betting") return;
    if (state.amount > balance) return;
    setState((p) => ({ ...p, staged: true, cashedAt: null }));
  };

  return (
    <div className="flex w-[128px] min-w-0 flex-col items-center gap-[4px]">
      <div className="flex h-[22px] items-center gap-[18px]">
        <span className="text-[0.75rem] font-bold leading-none text-white">Auto</span>
        <button
          type="button"
          onClick={() => setState((p) => ({ ...p, auto: !p.auto, mode: !p.auto ? "auto" : "bet" }))}
          aria-pressed={state.auto}
          className={`relative h-[19px] w-[43px] shrink-0 rounded-full border border-[#9A9DA0] transition-colors ${
            state.auto ? "bg-[#16A62A]" : "bg-[#25272A]"
          }`}
        >
          <span
            className={`absolute top-[2px] h-[13px] w-[13px] rounded-full bg-white transition-all ${
              state.auto ? "left-[26px]" : "left-[3px]"
            }`}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-[5px] gap-y-[3px]">
        {MOBILE_PRESETS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={locked}
            onClick={() => setState((p) => ({ ...p, amount: q }))}
            className={`h-[22px] w-[62px] rounded-full border border-[#B8BABD] bg-[#151719] text-[0.72rem] font-medium leading-none text-[#979A9E] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] disabled:opacity-40 ${
              state.amount === q ? "text-white" : ""
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={press}
        className={`mt-[7px] h-[49px] w-[109px] rounded-[8px] border text-[1.05rem] font-bold text-white shadow-[0_2px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] ${
          canCash
            ? "border-[#8A5A05] bg-[linear-gradient(180deg,#FFBC4B_0%,#F59E0B_55%,#C87C05_100%)]"
            : pending
              ? "border-[#7C0B0B] bg-[linear-gradient(180deg,#FF5A5A_0%,#EF0000_55%,#A80000_100%)]"
              : "border-[#0C5417] bg-[linear-gradient(180deg,#27C63E_0%,#16A62A_55%,#0B7A1B_100%)]"
        }`}
      >
        {canCash ? "Cash Out" : pending ? "Cancel" : "Cash In"}
      </button>

      {state.auto ? <div className="mt-[2px] flex h-[25px] w-[105px] items-center gap-[5px]">
        <button
          type="button"
          onClick={() => setState((p) => ({ ...p, auto: !p.auto }))}
          aria-pressed={state.auto}
          className={`relative h-[16px] w-[31px] shrink-0 rounded-full border border-[#55595F] transition-colors ${
            state.auto ? "bg-[#16A62A]" : "bg-[#1B1D20]"
          }`}
        >
          <span
            className={`absolute top-[2px] h-[10px] w-[10px] rounded-full bg-white transition-all ${
              state.auto ? "left-[18px]" : "left-[3px]"
            }`}
          />
        </button>
        <div className="flex h-[22px] min-w-0 flex-1 items-center gap-1 rounded-full bg-[#0B0C0E] px-2">
          <input
            type="number"
            step="0.01"
            min="1.01"
            value={state.autoCashout}
            onChange={(e) => {
              const v = Number(e.target.value);
              setState((p) => ({ ...p, autoCashout: Number.isFinite(v) ? v : p.autoCashout }));
            }}
            className="min-w-0 flex-1 bg-transparent text-center text-[0.66rem] font-bold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => setState((p) => ({ ...p, autoCashout: 1.1, auto: false }))}
            aria-label="Clear auto cashout"
            className="shrink-0 text-[0.72rem] leading-none text-white/45 hover:text-white"
          >
            ×
          </button>
        </div>
      </div> : null}



      {state.cashedAt ? (
        <p className="text-center text-[0.6rem] font-bold text-[#18B800]">
          {fmt(state.cashedAt)}x · {fmt(state.amount * state.cashedAt)}
        </p>
      ) : null}
    </div>
  );
}

/** Center column actions for the mobile betting controls — Edit / Clear / Min / Max. */
function MobileCenterActions({
  setSlot,
  editing,
  setEditing,
}: {
  setSlot: (i: number, fn: (p: PanelState) => PanelState) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
}) {
  const both = (fn: (p: PanelState) => PanelState) => {
    setSlot(0, fn);
    setSlot(1, fn);
  };
  const base =
    "h-[28px] w-[63px] rounded-[8px] text-[0.78rem] font-semibold leading-none shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.22)]";
  const outline = `${base} border border-[#85888B] bg-[#17191B] text-[#AEB1B5]`;
  return (
    <div className="flex flex-col items-center gap-[9px] pt-[35px]">
      <button
        type="button"
        onClick={() => setEditing(!editing)}
        className={`${base} border border-[#8A4A05] bg-[linear-gradient(180deg,#F5A63A_0%,#E8871E_52%,#C26A0C_100%)] text-white`}
      >

        Edit
      </button>
      <button
        type="button"
         onClick={() => both((p) => ({ ...p, amount: 100, staged: false }))}
        className={`${base} border border-[#7C0B0B] bg-[linear-gradient(180deg,#F04A4A_0%,#DE1C1C_52%,#A81010_100%)] text-white`}
      >
        Clear
      </button>
      <button type="button" onClick={() => both((p) => ({ ...p, amount: 100 }))} className={outline}>
        Min
      </button>
      <button
        type="button"
        onClick={() => both((p) => ({ ...p, amount: 10000 }))}
        className={`${outline} !w-[72px]`}
      >
        Max
      </button>
    </div>
  );
}

/** Mobile betting row: two slots + center Edit/Clear/Min/Max column. */
function MobileBetRow({
  slots,
  setSlot,
  phase,
  multiplier,
  onWin,
  balance,
}: {
  slots: PanelState[];
  setSlot: (i: number, fn: (p: PanelState) => PanelState) => void;
  phase: Phase;
  multiplier: number;
  onWin: (amount: number) => void;
  balance: number;
}) {
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState("");
  return (
    <div className="mx-auto w-full rounded-[14px] border border-[#2E3034] bg-[#1B1D20] px-[10px] pb-[7px] pt-[7px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:hidden">
      {editing ? (
        <div className="mb-[8px] flex items-center justify-center gap-2">
          <input
            type="number"
            value={custom}
            placeholder="Custom amount"
            onChange={(e) => setCustom(e.target.value)}
            className="h-[28px] w-[150px] rounded-[8px] bg-[#17191C] px-3 text-center text-[0.76rem] font-semibold text-white outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const v = Number(custom);
              if (Number.isFinite(v) && v >= 10) {
                setSlot(0, (p) => ({ ...p, amount: v }));
                setSlot(1, (p) => ({ ...p, amount: v }));
              }
              setEditing(false);
            }}
            className="h-[28px] rounded-[8px] bg-[#16A62A] px-3 text-[0.74rem] font-semibold text-white"
          >
            Apply
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-[128px_63px_128px] items-start justify-between">
        <MobileBetSlot
          state={slots[0]!}
          setState={(fn) => setSlot(0, fn)}
          phase={phase}
          multiplier={multiplier}
          onWin={onWin}
          balance={balance}
        />
        <MobileCenterActions setSlot={setSlot} editing={editing} setEditing={setEditing} />
        <MobileBetSlot
          state={slots[1]!}
          setState={(fn) => setSlot(1, fn)}
          phase={phase}
          multiplier={multiplier}
          onWin={onWin}
          balance={balance}
        />
      </div>
    </div>
  );
}



/* ---------------- desktop bet board (Bet | Auto tabs) ---------------- */

const DESKTOP_PRESETS = [10, 50, 100, 500, 1000, 2500, 5000, 10000];

function DesktopBetBoard({
  slots,
  setSlot,
  setAll,
  phase,
  multiplier,
  onWin,
  balance,
}: {
  slots: PanelState[];
  setSlot: (i: number, fn: (p: PanelState) => PanelState) => void;
  setAll: (fn: (p: PanelState) => PanelState) => void;
  phase: Phase;
  multiplier: number;
  onWin: (amount: number) => void;
  balance: number;
}) {
  const mode = slots[0]?.mode ?? "bet";
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState("");

  const cell =
    "h-[34px] rounded-full border bg-[#17191C] text-[0.82rem] font-semibold text-[#C6C9CE] transition-colors hover:bg-[#1E2124]";

  const press = (i: number) => {
    const s = slots[i];
    if (!s) return;
    const canCash = phase === "flying" && s.active && s.cashedAt === null;
    const pending = s.staged || (s.active && s.cashedAt === null);
    if (canCash) {
      onWin(s.amount * multiplier);
      setSlot(i, (p) => ({ ...p, cashedAt: multiplier }));
      return;
    }
    if (pending) {
      setSlot(i, (p) => ({ ...p, staged: false, active: false }));
      return;
    }
    // One bet per round: the round must finish before betting again.
    if (s.active && phase !== "betting") return;
    if (s.amount > balance) return;
    setSlot(i, (p) => ({ ...p, staged: true, cashedAt: null }));
  };

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex justify-center">
        <div className="flex w-[220px] rounded-[8px] bg-[#0B0C0E] p-[3px] text-[0.78rem] font-semibold text-white/55">
          {(["bet", "auto"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setAll((p) => ({ ...p, mode: m }))}
              className={`flex-1 rounded-[6px] py-[4px] capitalize ${
                mode === m ? "bg-[#2C2D30] text-white" : ""
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {editing ? (
        <div className="flex items-center justify-center gap-2">
          <input
            type="number"
            value={custom}
            placeholder="Custom amount"
            onChange={(e) => setCustom(e.target.value)}
            className="h-[34px] w-[180px] rounded-[10px] bg-[#17191C] px-3 text-center text-[0.82rem] font-semibold text-white outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const v = Number(custom);
              if (Number.isFinite(v) && v >= 10) setAll((p) => ({ ...p, amount: v }));
              setEditing(false);
            }}
            className="h-[34px] rounded-[10px] bg-[#16A62A] px-4 text-[0.8rem] font-semibold text-white"
          >
            Apply
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-[10px]">
        {DESKTOP_PRESETS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setAll((p) => ({ ...p, amount: q }))}
            className={`${cell} ${slots[0]?.amount === q ? "border-[#F20000] text-white" : "border-transparent"}`}
          >
            {q}
          </button>
        ))}
        <button type="button" onClick={() => setAll((p) => ({ ...p, amount: 10 }))} className={cell}>
          Min
        </button>
        <button
          type="button"
          onClick={() => setAll((p) => ({ ...p, amount: 10000 }))}
          className={cell}
        >
          Max
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="h-[34px] rounded-[10px] bg-[#D9821A] text-[0.82rem] font-semibold text-white"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setAll((p) => ({ ...p, amount: 10, staged: false }))}
          className="h-[34px] rounded-[10px] bg-[#F20000] text-[0.82rem] font-semibold text-white"
        >
          Clear
        </button>
      </div>

      <div className="grid grid-cols-4 gap-[10px]">
        {slots.map((s, i) => {
          const canCash = phase === "flying" && s.active && s.cashedAt === null;
          const pending = s.staged || (s.active && s.cashedAt === null);
          const tone = canCash ? "bg-[#F59E0B]" : pending ? "bg-[#EF0000]" : "bg-[#22B322]";
          return (
            <button
              key={i}
              type="button"
              onClick={() => press(i)}
              className={`h-[34px] rounded-[10px] text-[0.85rem] font-semibold text-white ${tone}`}
            >
              {canCash
                ? `Cash Out ${fmt(s.amount * multiplier)}`
                : pending
                  ? "Cancel"
                  : "Cash In"}
            </button>
          );
        })}
      </div>

      {mode === "auto" ? (
        <div className="grid grid-cols-4 gap-[10px]">
          {slots.map((s, i) => (
            <div key={i} className="flex items-center gap-[8px]">
              <button
                type="button"
                onClick={() => setSlot(i, (p) => ({ ...p, auto: !p.auto }))}
                aria-pressed={s.auto}
                className={`relative h-[18px] w-[36px] shrink-0 rounded-full transition-colors ${
                  s.auto ? "bg-[#16A62A]" : "bg-[#2A2C30]"
                }`}
              >
                <span
                  className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all ${
                    s.auto ? "left-[20px]" : "left-[2px]"
                  }`}
                />
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-[8px] bg-[#0B0C0E] px-3 py-[4px]">
                <input
                  type="number"
                  step="0.01"
                  min="1.01"
                  value={s.autoCashout}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSlot(i, (p) => ({
                      ...p,
                      autoCashout: Number.isFinite(v) ? v : p.autoCashout,
                    }));
                  }}
                  className="min-w-0 flex-1 bg-transparent text-center text-[0.8rem] font-bold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setSlot(i, (p) => ({ ...p, autoCashout: 1.1, auto: false }))}
                  aria-label="Clear auto cashout"
                  className="shrink-0 text-[0.85rem] leading-none text-white/45 hover:text-white"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}








/* ---------------- flight canvas ---------------- */

function FlightStage({
  phase,
  multiplier,
  countdown,
  muted,
  setMuted,
  feedLive,
}: {
  phase: Phase;
  multiplier: number;
  countdown: number;
  muted: boolean;
  setMuted: (fn: (v: boolean) => boolean) => void;
  feedLive: boolean | null;
}) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setT(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // progress 0..1 across the plot area — the plane reaches the target mark by ~1.50x, then hovers
  const raw = phase === "flying" ? Math.min(1, (multiplier - 1) / 0.5) : phase === "crashed" ? 1 : 0;
  const target = raw < 1 ? 1 - Math.pow(1 - raw, 1.6) : 1;

  // smooth the plane motion so a jumpy feed still renders a fluid flight
  const pRef = useRef(0);
  const lastRef = useRef(0);
  const crashRef = useRef(0);
  const dt = lastRef.current ? Math.min(0.06, (t - lastRef.current) / 1000) : 0;
  lastRef.current = t;
  if (phase === "betting") {
    pRef.current = 0;
    crashRef.current = 0;
  } else {
    pRef.current += (target - pRef.current) * Math.min(1, dt * 4.5);
    if (phase === "crashed") crashRef.current = Math.min(1, crashRef.current + dt * 1.15);
  }
  const p = pRef.current;

  const W = 760;
  const H = 320;
  // the plane only starts to bob once it has settled in the upper right corner
  const hoverScale = phase === "flying" ? Math.max(0, Math.min(1, (p - 0.55) / 0.25)) : 0;
  const hoverY = Math.sin(t / 780) * 10 * hoverScale + Math.sin(t / 310) * 2.5 * hoverScale;
  const hoverX = Math.cos(t / 1150) * 15 * hoverScale;
  const x0 = 44;
  const y0 = H - 40;
  const x = x0 + p * (W - 210) + hoverX;
  const y = y0 - Math.pow(p, 1.25) * (H - 120) + hoverY;
  // fly-away easing after the crash instead of an instant jump
  const flewT = phase === "crashed" ? crashRef.current * crashRef.current : 0;
  const px = x + flewT * 420;
  const py = y - flewT * 240;

  // smooth cubic trail: hugs the floor first, then sweeps up to the plane
  const c1x = x0 + (x - x0) * 0.55;
  const c1y = y0;
  const c2x = x0 + (x - x0) * 0.82;
  const c2y = y0 - (y0 - y) * 0.42;
  const path = `M${x0},${y0} C ${c1x},${c1y} ${c2x},${c2y} ${x},${y}`;
  const area = `${path} L ${x},${y0} Z`;
  const planeW = 84;
  const planeH = planeW * (74 / 150);
  // flying plane is noticeably bigger than the parked waiting plane
  const flyPlaneW = 132;
  const flyPlaneH = flyPlaneW * (74 / 150);
  return (
    <div className="relative overflow-hidden rounded-[13px] border border-[#2B2D31] bg-black">
      {/* spribe-style rotating sun rays from the bottom-left */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[4%] top-[96%] h-[1100px] w-[1100px] -translate-x-1/2 -translate-y-1/2 opacity-90">
          <div
            className={`h-full w-full rounded-full ${phase === "flying" ? "animate-[av-spin_18s_linear_infinite]" : ""}`}
            style={{
              background:
                "repeating-conic-gradient(from 0deg, #14171C 0deg 6.5deg, #000000 6.5deg 13deg)",
              maskImage: "radial-gradient(circle, #000 0%, #000 52%, transparent 82%)",
              WebkitMaskImage: "radial-gradient(circle, #000 0%, #000 52%, transparent 82%)",
            }}
          />
        </div>
      </div>
      <style>{`@keyframes av-spin{to{transform:rotate(360deg)}}
@keyframes av-prop{to{transform:rotate(360deg)}}
@keyframes av-row-in{from{opacity:0;transform:translateY(-10px) scale(0.98)}to{opacity:1;transform:none}}
.av-row-in{animation:av-row-in .38s cubic-bezier(.2,.8,.3,1)}`}</style>


      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="relative block aspect-[6/5] h-auto w-full sm:aspect-[19/9] lg:aspect-[19/8] lg:max-h-[430px]"
      >
        <defs>
          <linearGradient id="av-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A80D22" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#6B0616" stopOpacity="0.45" />
          </linearGradient>

          <filter id="av-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <line x1="18" y1={H - 18} x2={W - 18} y2={H - 18} stroke="#ffffff22" strokeWidth="2" />
        <line x1="18" y1="18" x2="18" y2={H - 18} stroke="#ffffff22" strokeWidth="2" />
        {/* Plot marks stay fixed while the plane and curve move. */}
        {Array.from({ length: 12 }).map((_, i) => (
          <circle
            key={`bx${i}`}
            cx={42 + i * 62}
            cy={H - 18}
            r="2.5"
            fill="#ffffff35"
          />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <circle
            key={`by${i}`}
            cy={H - 62 - i * 55}
            cx="18"
            r="2.5"
            fill="#20BFFF"
          />
        ))}

        {/* plane parked in the bottom-left corner while waiting */}
        {phase === "betting" ? (
          <image
            href={aviatorPlane}
            x={16}
            y={H - 24 - planeH}
            width={planeW}
            height={planeH}
            opacity={0.95}
          />
        ) : null}

        {phase === "flying" ? (
          <>
            <path d={area} fill="url(#av-area)" />
            <path
              d={path}
              fill="none"
              stroke="#FF1238"
              strokeWidth="4.5"
              strokeLinecap="round"
              filter="url(#av-glow)"
            />

            <image
              href={aviatorPlane}
              x={px - flyPlaneW * 0.12}
              y={py - flyPlaneH * 0.6}
              width={flyPlaneW}
              height={flyPlaneH}
              transform={`rotate(8 ${px - flyPlaneW * 0.12 + flyPlaneW / 2} ${py - flyPlaneH * 0.6 + flyPlaneH / 2})`}
            />



          </>
        ) : null}
      </svg>


      <button
        type="button"
        onClick={() => setMuted((v) => !v)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute left-3 top-2 z-10 text-white/85"
      >
        <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true">
          <path d="M2 6.5h3L9.5 3v12L5 11.5H2z" fill="currentColor" />
          {muted ? (
            <>
              <path d="M13 6.5l5 5M18 6.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M13 6a4 4 0 010 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              <path d="M15.5 4a7 7 0 010 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            </>
          )}
        </svg>
      </button>


      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {phase === "betting" ? (
          <>
            <img
              src={propellerImg.url}
              alt=""
              aria-hidden="true"
              className="mb-3 h-[54px] w-[54px] sm:h-[88px] sm:w-[88px]"
              style={{ animation: "av-prop 2.6s linear infinite" }}
            />

            <p className="px-4 text-center text-[20px] font-medium uppercase text-white sm:text-[2rem]">
              WAITING FOR NEXT ROUND
            </p>
            <div className="mt-3 h-[4px] w-[100px] overflow-hidden bg-[#292C32] sm:mt-4 sm:w-[180px]">
              <div
                className="h-full bg-[#F00032]"
                style={{ width: `${Math.max(0, Math.min(100, (countdown / BET_MS) * 100))}%` }}
              />
            </div>
          </>


        ) : phase === "crashed" ? (
          <>
            <p className="text-[1rem] font-medium uppercase text-white sm:text-[2.1rem]">
              FLEW AWAY!
            </p>

            <p className="mt-2 text-[3rem] font-extrabold leading-none text-[#E9002B] drop-shadow-[0_4px_14px_rgba(0,0,0,.7)] sm:text-[4.6rem] lg:text-[5.6rem]">
              {fmt(multiplier)}x
            </p>
          </>
        ) : (
          <p className="text-[3rem] font-extrabold leading-none text-white drop-shadow-[0_6px_26px_rgba(0,0,0,.65)] sm:text-[5rem] lg:text-[6.6rem]">
            {fmt(multiplier)}x
          </p>
        )}


      </div>
    </div>
  );
}


/* ---------------- main ---------------- */

type MyBet = { round: number; amount: number; cashedAt: number | null; crash: number };



export function Aviator() {
  const { admin, cfg } = useAdminConfig();
  const avRef = useRef<AviatorControl | null>(null);
  avRef.current = admin ? cfg.aviator : null;

  const [tab, setTab] = useState<"all" | "my" | "top">("all");
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [phase, setPhase] = useState<Phase>("betting");
  const [multiplier, setMultiplier] = useState(1);
  const [countdown, setCountdown] = useState(BET_MS);
  const [histOpen, setHistOpen] = useState(false);
  const [history, setHistory] = useState<number[]>([2.31, 1.14, 5.62, 1.02, 11.4, 1.87, 3.05, 1.45, 4.35, 23.12, 2.53, 1.46, 3.53, 1.4, 14.99, 11.63, 3.68, 3.1, 1.75, 7.28, 1.79, 1.02, 1.0, 1.78, 27.0, 2.03, 2.45, 2.3, 2.48, 4.03]);
  const [round, setRound] = useState(1);
  const [balance, setBalance] = useState(5000);
  const embedded = useEmbed();
  const [bets, setBets] = useState<LiveBet[]>([]);
  const [muted, setMuted] = useState(true);
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const sfx = useCallback(
    (src: string, vol = 0.6) => {
      if (muted) return;
      try {
        const a = new Audio(src);
        a.volume = vol;
        void a.play();
      } catch {
        /* autoplay blocked */
      }
    },
    [muted],
  );


  const [slots, setSlots] = useState<PanelState[]>(() => [100, 100, 100, 100].map(initialPanel));
  // Bet references sent to the operator wallet, per slot (integrated launch).
  const betRefs = useRef<Record<number, string>>({});
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  // when the player cashes out, mark their matching row in the live list
  useEffect(() => {
    const session = playerSession();
    if (session) {
      slots.forEach((s, i) => {
        const ref = betRefs.current[i];
        if (s.active && s.cashedAt !== null && ref) {
          delete betRefs.current[i];
          void remoteCashout(session, ref, s.cashedAt);
        }
      });
    }
    const cashed = slots.filter((s) => s.active && s.cashedAt !== null);
    if (!cashed.length) return;
    setBets((list) => {
      const next = [...list];
      for (const s of cashed) {
        const idx = next.findIndex((b) => b.cashedAt === undefined && b.amount === s.amount);
        if (idx >= 0) next[idx] = { ...next[idx]!, cashedAt: s.cashedAt! };
      }
      return next;
    });
  }, [slots]);
  const setSlot = useCallback(
    (i: number, fn: (p: PanelState) => PanelState) =>
      setSlots((s) => s.map((p, j) => (j === i ? fn(p) : p))),
    [],
  );
  const setAllSlots = useCallback(
    (fn: (p: PanelState) => PanelState) => setSlots((s) => s.map(fn)),
    [],
  );
  


  const crashRef = useRef(1);
  const startRef = useRef(0);
  const phaseRef = useRef<Phase>("betting");
  phaseRef.current = phase;

  // official results feed (same upstream round series as the live crash game)
  const seenRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<number[]>([]); // unused official winners, oldest first
  const officialRef = useRef(false);
  const bootedRef = useRef(false);
  const [feedLive, setFeedLive] = useState<boolean | null>(null);


  useEffect(() => {
    let stop = false;
    let busy = false;
    const pull = async () => {
      if (stop || busy) return;
      busy = true;
      try {
        const ctrl = new AbortController();
        const to = window.setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch("/api/public/uapi/games/88.0023/results", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        window.clearTimeout(to);
        const json = (await res.json()) as { data?: { roundId?: string; winner?: string }[] };
        const rows = Array.isArray(json?.data) ? json.data : [];
        if (!rows.length) { setFeedLive(false); return; }
        setFeedLive(true);
        // newest first from upstream
        const fresh: number[] = [];
        for (const r of rows) {
          const id = String(r?.roundId ?? "");
          const w = Number(r?.winner);
          if (!id || !(w > 0)) continue;
          if (seenRef.current.has(id)) continue;
          seenRef.current.add(id);
          fresh.push(w);
        }
        if (bootedRef.current && fresh.length) {
          // push oldest-first into the queue so rounds play out in real order
          queueRef.current.push(...fresh.reverse());
          if (queueRef.current.length > 12) queueRef.current = queueRef.current.slice(-12);
        }
        bootedRef.current = true;
        const strip = rows
          .map((r) => Number(r?.winner))
          .filter((n) => n > 0)
          .slice(0, 24);
        if (strip.length) setHistory(strip);
      } catch {
        setFeedLive(false);
      } finally {
        busy = false;
        if (!stop) window.setTimeout(pull, 1500);
      }
    };
    void pull();
    return () => {
      stop = true;
    };
  }, []);


  // live round state (WAIT / RUN / BLAST) — same series as the real game
  const liveRef = useRef<{ rid: string; status: string; mult: number; at: number } | null>(null);
  useEffect(() => {
    let stop = false;
    const pull = async () => {
      try {
        const res = await fetch("/api/public/uapi/games/88.0023/state", { cache: "no-store" });
        const j = (await res.json()) as {
          data?: { roundId?: string; status?: string; multiplier?: string | number };
        };
        const d = j?.data;
        if (d?.roundId) {
          liveRef.current = {
            rid: String(d.roundId),
            status: String(d.status ?? "").toUpperCase(),
            mult: Math.max(1, Number(d.multiplier) || 1),
            at: performance.now(),
          };
        }
      } catch {
        /* keep last known state */
      }
      if (!stop) window.setTimeout(pull, 400);
    };
    void pull();
    return () => {
      stop = true;
    };
  }, []);

  const win = useCallback((amt: number) => {
    setBalance((b) => Math.round((b + amt) * 100) / 100);
    sfx(winSound.url, 0.65);
  }, [sfx]);

  // round loop — driven by the live feed, falls back to a local sim if it dies
  useEffect(() => {
    let raf = 0;
    let mounted = true;

    // shared helpers
    const stageBets = () => {
      // real bets only: rows appear when THIS player actually places a bet
      const newly = slotsRef.current.filter((p) => p.staged);
      if (newly.length) {
        const user = playerSession()?.userId ?? "you";
        setBets((cur) => [
          ...newly.map((p, i) => ({
            id: Date.now() + i,
            user,
            amount: p.amount,
            bal: 0,
            target: p.auto && p.autoCashout > 1 ? p.autoCashout : 0,
          })),
          ...cur,
        ]);
      }
      setSlots((list) =>
        list.map((p) =>
          p.staged
            ? { ...p, staged: false, active: true, cashedAt: null }
            : { ...p, active: false, cashedAt: null },
        ),
      );
    };

    const botCashouts = (m: number) =>
      setBets((list) =>
        list.map((b) =>
          b.cashedAt === undefined && b.target > 1 && b.target <= m
            ? {
                ...b,
                cashedAt: Math.round(b.target * 100) / 100,
                bal: Math.round(b.bal + b.amount * (b.target - 1)),
              }
            : b,
        ),
      );

    const bustAll = () =>
      setBets((list) =>
        list.map((b) =>
          b.cashedAt === undefined ? { ...b, busted: true, bal: Math.max(0, b.bal - b.amount) } : b,
        ),
      );

    // feed-driven state
    let fRid = "";
    let fPhase: Phase | "" = "";
    let fPeak = 1;
    let shown = 1; // smoothed multiplier so the counter ticks 1.01, 1.02, … instead of jumping
    let waitStart = 0;





    const frame = () => {
      if (!mounted) return;
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const live = liveRef.current;
      const fresh = live !== null && now - live.at < 10000;

      if (fresh && live) {
        if (live.rid !== fRid) {
          fRid = live.rid;
          fPeak = 1;
          shown = 1;
        }

        // admin crash control (console → Game control → VIMAAN)
        const ctl = avRef.current;
        const cap =
          ctl && ctl.mode === "never"
            ? 1
            : ctl && ctl.mode === "forced"
              ? Math.max(1, ctl.crash)
              : Infinity;

        const doCrash = (crash: number) => {
          if (fPhase !== "crashed") {
            fPhase = "crashed";
            crashRef.current = crash;
            fPeak = crash;
            shown = crash;
            setMultiplier(crash);
            setPhase("crashed");
            setRound((r) => r + 1);
            bustAll();
          } else {
            shown = crash;
            setMultiplier(crash);
          }
        };

        if (live.status === "RUN") {
          fPeak = Math.min(Math.max(fPeak, live.mult), cap);
          if (fPhase !== "flying" && fPhase !== "crashed") {
            fPhase = "flying";
            shown = Math.min(shown, fPeak);
            stageBets();
            setPhase("flying");
          }
          if (cap !== Infinity && fPeak >= cap) {
            doCrash(cap);
            return;
          }
          // ease toward the feed value so the number climbs step by step
          const gap = fPeak - shown;
          shown = gap <= 0.005 ? fPeak : shown + Math.max(0.004, gap * 0.12);
          if (shown > fPeak) shown = fPeak;
          setMultiplier(shown);
          botCashouts(shown);
        } else if (live.status === "BLAST") {
          const crash = Math.min(Math.max(fPeak, live.mult), cap);
          if (fPhase !== "crashed") {
            fPhase = "crashed";
            crashRef.current = crash;
            fPeak = crash;
            shown = crash;
            setMultiplier(crash);
            setPhase("crashed");
            setRound((r) => r + 1);
            bustAll();
          } else {
            shown = crash;
            setMultiplier(crash);
          }
        } else {

          // WAIT (or unknown) → betting window
          if (fPhase !== "betting") {
            fPhase = "betting";
            waitStart = now;
            shown = 1;
            setMultiplier(1);

            setBets([]);
            setSlots((list) => list.map((p) => ({ ...p, active: false, cashedAt: null })));
            setPhase("betting");
          }
          setCountdown(Math.max(0, BET_MS - (now - waitStart)));
        }
        return;
      }

      // ---- feed lost: never fake a crash, just idle in a waiting state ----
      fPhase = "";
      fRid = "";
      fPeak = 1;
      if (phaseRef.current !== "betting") {
        setPhase("betting");
        setMultiplier(1);
      }
      setCountdown(0);

    };

    raf = requestAnimationFrame(frame);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, []);


  // deduct stake when flight starts
  useEffect(() => {
    if (phase !== "flying") return;
    const session = playerSession();
    let stake = 0;
    slots.forEach((p, i) => {
      if (!p.active || p.cashedAt !== null) return;
      stake += p.amount;
      if (session) {
        const ref = `av-${Date.now()}-${i}`;
        betRefs.current[i] = ref;
        void remoteBet(session, {
          gameId: "88.0030",
          roundId: String(round),
          selection: "VIMAAN",
          odds: 1.01,
          stake: p.amount,
          reference: ref,
        });
      }
    });
    if (stake && !session) setBalance((b) => Math.round((b - stake) * 100) / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // auto cashout
  useEffect(() => {
    if (phase !== "flying") return;
    slots.forEach((p, i) => {
      if (p.auto && p.active && p.cashedAt === null && multiplier >= p.autoCashout) {
        win(p.amount * p.autoCashout);
        setSlot(i, (q) => ({ ...q, cashedAt: q.autoCashout }));
      }
    });
  }, [multiplier, phase, slots, win, setSlot]);

  // record my bets when the round settles
  useEffect(() => {
    if (phase !== "crashed") return;
    const session = playerSession();
    if (session) {
      slots.forEach((p, i) => {
        const ref = betRefs.current[i];
        if (p.active && p.cashedAt === null && ref) {
          delete betRefs.current[i];
          void remoteSettle(session, ref, "lost");
        }
      });
    }
    const rows: MyBet[] = [];
    for (const p of slots) {
      if (p.active) rows.push({ round, amount: p.amount, cashedAt: p.cashedAt, crash: multiplier });
    }

    if (rows.length) {
      setMyBets((m) => [...rows, ...m].slice(0, 40));
      for (const r of rows) {
        logBet({
          ts: Date.now(),
          gameId: "88.0030",
          gameName: "VIMAAN",
          round: String(r.round),
          stake: r.amount,
          multiplier: r.cashedAt,
          payout: r.cashedAt ? Math.round(r.amount * r.cashedAt * 100) / 100 : 0,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    saveBalance(balance);
  }, [balance]);

  // engine loop while the plane is in the air
  useEffect(() => {
    if (muted) {
      bgRef.current?.pause();
      return;
    }
    if (phase === "flying") {
      if (!bgRef.current) {
        const a = new Audio(bgSound.url);
        a.loop = true;
        a.volume = 0.35;
        bgRef.current = a;
      }
      void bgRef.current.play().catch(() => undefined);
    } else {
      bgRef.current?.pause();
    }
  }, [phase, muted]);

  useEffect(() => () => bgRef.current?.pause(), []);

  // crash sound
  useEffect(() => {
    if (phase === "crashed") sfx(crashSound.url, 0.7);
  }, [phase, sfx]);

  // countdown beeps 3..2..1
  const beepRef = useRef(-1);
  useEffect(() => {
    if (phase !== "betting") {
      beepRef.current = -1;
      return;
    }
    const secs = Math.ceil(countdown / 1000);
    if (secs <= 3 && secs >= 1 && beepRef.current !== secs) {
      beepRef.current = secs;
      sfx(beepSound.url, 0.5);
    }
  }, [countdown, phase, sfx]);




  return (
    <div className="overflow-hidden bg-[#090A0C] sm:rounded-[16px] sm:border sm:border-[#303238] sm:p-3">
      <div className="grid items-stretch gap-2 lg:h-[680px] lg:grid-cols-[minmax(340px,27%)_1fr]">
        {/* bets + chat */}
        <div className="order-2 flex min-w-0 flex-col overflow-hidden bg-[#151618] p-2 lg:order-1 sm:rounded-[14px] sm:border sm:border-[#303238] sm:p-3">

          <div className="mx-auto flex w-[150px] rounded-full bg-[#0B0C0E] p-[2px] text-[0.58rem] font-semibold text-white/50 sm:w-[86%] sm:max-w-[300px] sm:p-[3px] sm:text-[0.78rem]">
            {([["all", "All Bets"], ["my", "My Bets"]] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`h-[17px] flex-1 rounded-full px-2 leading-none sm:h-[20px] ${
                  tab === k ? "bg-[#2C2D30] text-white" : ""
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {tab === "all" ? (
            <div className="mt-[6px] flex items-start justify-between px-[6px] text-[0.68rem] font-bold text-white/90 sm:mt-[10px] sm:px-0 sm:text-[0.7rem]">
              <span className="flex flex-col gap-[2px] leading-tight">
                ALL BETS
                <span className="text-[0.66rem] font-semibold text-white/60">{bets.length}</span>
              </span>
              <span className="flex flex-col items-end gap-[2px] leading-tight">
                <span>Users</span>
                <span className="text-[0.66rem] font-semibold text-white/60">{bets.length.toLocaleString()}</span>
              </span>
            </div>
          ) : null}

          {tab === "my" ? (
            <div className="mt-[6px] flex items-start justify-between px-[6px] text-[0.68rem] font-bold text-white/90 sm:mt-[10px] sm:px-0 sm:text-[0.7rem]">
              <span className="flex flex-col gap-[2px] leading-tight">
                MY BETS
                <span className="text-[0.66rem] font-semibold text-white/60">
                  {myBets.length + slots.filter((p) => p.staged || p.active).length}
                </span>
              </span>
              {embedded ? null : (
                <span className="flex flex-col items-end gap-[2px] leading-tight">
                  <span>Balance</span>
                  <span className="text-[0.66rem] font-semibold text-[#18C800]">{fmt(balance)}</span>
                </span>
              )}
            </div>
          ) : null}

          <div className="mt-[5px] grid h-[18px] grid-cols-[1fr_38px_44px_54px] items-center gap-x-2 border-b border-white/10 bg-[#111214] px-[6px] text-[0.55rem] font-medium text-white/35 sm:mt-[8px] sm:px-2 sm:text-[0.58rem]">
            <span>{tab === "my" ? "Round" : "User"}</span>
            <span>Bet</span>
            <span>X</span>
            <span className="text-right">Cash out</span>
          </div>


          <div
            className="flex h-[430px] w-full min-w-0 flex-1 flex-col gap-0 overflow-y-auto overflow-x-hidden overscroll-contain pt-2 lg:h-0 lg:min-h-0"
            style={{
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
              display: "flex",
              flexDirection: "column",
            }}
          >


            {tab === "my"
              ? [
                  ...slots
                    .filter((p) => p.staged || p.active)
                    .map((p, i) => (
                      <div
                        key={`live-${i}`}
                        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-1.5 rounded-[7px] border border-[#20BFFF]/40 bg-[#0C1C2B] px-1.5 py-[6px] text-[0.72rem] text-white sm:gap-x-3 sm:px-2 sm:text-[0.78rem]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <img src={AVATARS[0]} alt="" className="h-[24px] w-[24px] rounded-full object-cover" />
                          <span className="flex min-w-0 flex-col leading-tight">
                            <span className="truncate font-semibold text-[#20BFFF]">You</span>
                            <span className="text-[0.64rem] text-white/45">
                              #{round} {p.staged ? "queued" : "live"}
                            </span>
                          </span>
                        </span>
                        <span className="font-semibold">{p.amount}</span>
                        <span className="rounded-full bg-[#0B1B27] px-[6px] py-[1px] text-[0.66rem] font-bold text-[#20BFFF]">
                          {p.cashedAt ? `${fmt(p.cashedAt)}x` : phase === "flying" ? `${fmt(multiplier)}x` : "—"}
                        </span>
                        <span className="text-right font-bold">
                          {p.cashedAt ? fmt(p.amount * p.cashedAt) : ""}
                        </span>
                      </div>
                    )),
                  ...myBets.map((b, i) => (
                    <div
                      key={`${b.round}-${i}`}
                      className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-1.5 rounded-[7px] border px-1.5 py-[6px] text-[0.72rem] sm:gap-x-3 sm:px-2 sm:text-[0.78rem] ${
                        b.cashedAt
                          ? "border-[#3B8F20] bg-[#0D4206] text-white"
                          : "border-white/[0.06] bg-[#1A1113] text-white/50"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <img src={AVATARS[0]} alt="" className="h-[24px] w-[24px] rounded-full object-cover" />
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate font-semibold">You</span>
                          <span className="text-[0.64rem] text-white/40">#{b.round}</span>
                        </span>
                      </span>
                      <span className="font-semibold">{b.amount}</span>
                      <span
                        className={`rounded-full px-[6px] py-[1px] text-[0.66rem] font-bold ${
                          b.cashedAt ? "bg-[#052208] text-[#7CFF56]" : "bg-[#2A1113] text-[#F98080]"
                        }`}
                      >
                        {b.cashedAt ? `${fmt(b.cashedAt)}x` : `${fmt(b.crash)}x`}
                      </span>
                      <span className="text-right font-bold">
                        {b.cashedAt ? fmt(b.amount * b.cashedAt) : ""}
                      </span>
                    </div>
                  )),
                ]
              : bets.slice(0, 80).map((b, i) => {
                  const done = b.cashedAt !== undefined;
                  return (
                    <div
                      key={`${b.id}-${i}`}
                      className={`grid shrink-0 grid-cols-[1fr_38px_44px_54px] items-center gap-x-2 px-2 py-[5px] text-[0.64rem] sm:text-[0.8rem] ${
                        done
                          ? "rounded-[7px] border border-[#3B8F20] bg-[#0D4206] text-white"
                          : "border-b border-white/[0.05] bg-[#131416] text-white/70"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-[6px]">
                        <img
                          src={AVATARS[b.id % AVATARS.length]}
                          alt=""
                          loading="lazy"
                          width={96}
                          height={96}
                          className="h-[21px] w-[21px] shrink-0 rounded-full object-cover"
                        />
                        <span className={`truncate ${done ? "font-semibold text-white" : "text-[#7E92B5]"}`}>
                          {maskName(b.user)}
                        </span>
                      </span>
                      <span className={`font-semibold ${done ? "text-white" : "text-white/90"}`}>{b.amount}</span>

                      <span
                        className={`shrink-0 justify-self-start rounded-full px-2 py-[1px] text-[0.6rem] font-bold ${
                          done ? "border border-[#3B8F20]/60 bg-[#052208] text-[#7CFF56]" : ""
                        }`}
                      >
                        {done ? `${fmt(b.cashedAt!)}x` : ""}
                      </span>

                      <span className={`text-right font-bold ${done ? "text-white" : "text-white/25"}`}>
                        {done ? fmt(b.amount * b.cashedAt!) : "—"}
                      </span>
                    </div>
                  );
                })}



            {tab === "all" && bets.length === 0 ? (
              <p className="py-10 text-center text-[0.72rem] text-white/40">No bets yet</p>
            ) : null}
            {tab === "my" && myBets.length === 0 ? (
              <p className="py-10 text-center text-[0.72rem] text-white/40">No bets yet</p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-2 gap-y-[2px] border-t border-white/10 px-1 pb-[26px] pt-[12px] text-[0.7rem] text-white/50 sm:text-[0.75rem]">
            <span className="flex items-center gap-1">
              This game is
              <img src={fairIcon} alt="" className="h-[16px] w-[15px]" />
              <span className="font-semibold text-white/80">Provably Fair</span>
            </span>
            <span>
              Powered by <span className="font-bold text-white underline">VIMAAN</span>
            </span>
          </div>

        </div>

        {/* stage + panels */}
        <div className="order-1 flex min-w-0 flex-col gap-2 lg:order-2 lg:min-h-0">
          {/* history strip — sits above the flying stage */}
          <div className="bg-[#090A0C] px-[6px] py-[3px] sm:rounded-[8px] sm:border sm:border-[#34363B] sm:bg-[#202125] sm:px-3 sm:py-2">
            {histOpen ? (
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.03em] text-white">
                  Round History
                </span>
                <HistToggle open={histOpen} onClick={() => setHistOpen(false)} />
              </div>
            ) : null}

            <div className="flex min-w-0 items-center gap-[4px] sm:gap-2">
              <div
                className={`flex min-w-0 flex-1 items-center gap-x-[3px] gap-y-[5px] sm:gap-x-2 ${
                  histOpen
                    ? "flex-wrap justify-center"
                    : "flex-nowrap overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                }`}
              >
                {(histOpen ? history : history.slice(0, 40)).map((h, i) => (
                  <span
                    key={`${h}-${i}`}
                    className={`shrink-0 rounded-full bg-[#090B0E] px-[5px] py-[1px] text-[0.58rem] font-semibold leading-[16px] sm:px-[8px] sm:py-[2px] sm:text-[0.72rem] ${chipTone(h)}`}
                  >
                    {fmt(h)}x
                  </span>
                ))}
              </div>
              {histOpen ? null : <HistToggle open={histOpen} onClick={() => setHistOpen(true)} />}
            </div>
          </div>



          <FlightStage phase={phase} multiplier={multiplier} countdown={countdown} muted={muted} setMuted={setMuted} feedLive={feedLive} />

          <div className="bg-[#111315] px-[2px] pb-[2px] pt-[3px] sm:rounded-[12px] sm:border sm:border-[#292D32] sm:p-4 lg:flex lg:flex-1 lg:flex-col lg:justify-start">
            {/* mobile: left presets | center actions | right presets */}
            <MobileBetRow
              slots={slots}
              setSlot={setSlot}
              phase={phase}
              multiplier={multiplier}
              onWin={win}
              balance={balance}
            />



            <div className="mt-2 hidden sm:mt-3 sm:block">
              <DesktopBetBoard
                slots={slots}
                setSlot={setSlot}
                setAll={setAllSlots}
                phase={phase}
                multiplier={multiplier}
                onWin={win}
                balance={balance}
              />
            </div>

          </div>


        </div>
      </div>
    </div>
  );
}
