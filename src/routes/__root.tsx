import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEmbed } from "@/lib/embed";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Universal API — Live Casino & Sports Feeds" },
      {
        name: "description",
        content:
          "Universal API delivers live casino table games and sports markets with real-time odds, results and developer docs.",
      },
      { name: "author", content: "Universal API" },
      { property: "og:title", content: "Universal API — Live Casino & Sports Feeds" },
      {
        property: "og:description",
        content: "Live casino table games and sports markets via the Universal API.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

import WinCelebration from "@/components/WinCelebration";
import { useWallet } from "@/lib/wallet";

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const NAV = [
  { to: "/", label: "Games", stackMobile: false },
  { to: "/sports", label: "Sports", stackMobile: false },
  { to: "/casino-docs", label: "Casino Docs", stackMobile: true },
  { to: "/sports-docs", label: "Sports Docs", stackMobile: true },
] as const;

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
      />
    </svg>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ua-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const label = dark ? "Light mode" : "Dark mode";

  return (
    <div className="group relative hidden sm:block">
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          const next = !dark;
          setDark(next);
          document.documentElement.classList.toggle("dark", next);
          localStorage.setItem("ua-theme", next ? "dark" : "light");
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full text-nav-foreground/85 transition-colors hover:bg-nav-foreground/10 hover:text-nav-foreground"
      >
        {dark ? <MoonIcon /> : <SunIcon />}
      </button>
      <span className="pointer-events-none absolute right-0 top-full mt-1 whitespace-nowrap rounded bg-nav px-2 py-1 text-xs text-nav-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-nav-foreground/10 bg-nav">
      <div className="mx-auto grid min-h-[76px] max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2 sm:flex sm:min-h-[60px] sm:justify-between sm:gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-2 sm:gap-3">
          <img
            src="/favicon.svg"
            alt="Universal API"
            className="h-8 w-8 rounded-lg"
          />
          <span className="max-w-[80px] text-lg font-bold leading-tight tracking-tight text-nav-foreground sm:max-w-none sm:text-xl">
            Universal API
          </span>
        </Link>
        <nav className="flex min-w-0 items-center justify-end gap-x-3 sm:flex-wrap sm:gap-x-5 sm:gap-y-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className={`text-[0.82rem] font-semibold leading-tight text-nav-foreground transition-colors hover:text-nav-active sm:text-[0.95rem] ${item.stackMobile ? "whitespace-pre-line text-center" : ""}`}
              activeProps={{ className: "!text-nav-active" }}
            >
              {item.stackMobile ? (
                <>
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.label.replace(" ", "\n")}</span>
                </>
              ) : (
                item.label
              )}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

/** Dukex-style in-game bar, phone view only on casino game pages. */
function GameTopBar() {
  const w = useWallet();
  const exposure = w.bets.filter((b) => b.status === "open").reduce((t, b) => t + b.stake, 0);
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const btn = "flex h-[36px] w-[36px] items-center justify-center rounded-[4px] border border-[#555] bg-[#2b2b2b] text-white";
  return (
    <header className="sticky top-0 z-40 flex h-[56px] items-center gap-2 bg-[#1e1e1e] px-1.5 font-[Tahoma,Helvetica,Arial,sans-serif] text-white sm:hidden">
      <Link to="/casino-docs" className="flex h-[36px] items-center rounded-[4px] border border-[#555] bg-[#2b2b2b] px-3 text-[0.72rem] font-bold">Rules</Link>
      <Link to="/" className="flex h-[36px] flex-col items-center justify-center rounded-[4px] bg-gradient-to-b from-[#7ed957] to-[#3fa31f] px-3 text-center text-[0.68rem] font-bold leading-[1.15] text-[#111]">GAMING<br />LOBBY</Link>
      <div className="ml-auto text-right text-[0.74rem] font-bold leading-[1.45]">
        <div>Main PTI {fmt(w.balance)}</div>
        <div>Exposure (<span className="text-[#ff2020]">{fmt(exposure)}</span>)</div>
      </div>
      <button type="button" aria-label="Refresh" onClick={() => window.location.reload()} className={btn}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4" /></svg>
      </button>
      <Link to="/my-bets" aria-label="Bet history" className={btn}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4" /><path d="M12 8v4l3 2" /></svg>
      </Link>
    </header>
  );
}

function SportsTopBar() {
  const wallet = useWallet();
  const exposure = wallet.bets
    .filter((bet) => bet.status === "open" && bet.gameId.startsWith("sports-"))
    .reduce((total, bet) => total + bet.stake, 0);
  const fmt = (value: number) =>
    value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const iconButton =
    "flex h-[36px] w-[36px] items-center justify-center rounded-[3px] border border-nav-foreground/20 bg-nav text-nav-foreground";

  return (
    <header className="sticky top-0 z-40 flex h-[56px] items-center gap-2 border-b border-nav-foreground/10 bg-nav px-1.5 font-[Tahoma,Helvetica,Arial,sans-serif] text-nav-foreground sm:hidden">
      <Link
        to="/my-bets"
        className="flex h-[36px] items-center gap-1.5 rounded-[3px] border border-nav-foreground/20 bg-nav px-2.5 text-[0.8rem] font-bold"
      >
        <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full border-2 border-current text-[0.65rem]">₹</span>
        Bets
      </Link>
      <div className="ml-auto text-right text-[0.7rem] font-bold leading-[1.45]">
        <div>Main PTI {fmt(wallet.balance)}</div>
        <div>Exposure (<span className="text-ex-suspend">{fmt(exposure)}</span>)</div>
      </div>
      <button type="button" aria-label="Refresh match" onClick={() => window.location.reload()} className={iconButton}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4" /></svg>
      </button>
      <Link to="/my-bets" aria-label="Account and bet history" className={iconButton}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 12c-5 0-8 2.5-8 5.5V22h16v-2.5C20 16.5 17 14 12 14Z" /></svg>
      </Link>
    </header>
  );
}

function SportsBottomNav() {
  const items = [
    { to: "/sports" as const, label: "Home", icon: "⌂" },
    { to: "/sports" as const, label: "In-Play", icon: "◷" },
    { to: "/sports" as const, label: "Sports", icon: "♕" },
    { to: "/" as const, label: "Casino", icon: "◉" },
    { to: "/my-bets" as const, label: "Account", icon: "◯" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto grid h-[62px] max-w-[430px] grid-cols-5 bg-nav text-nav-foreground sm:hidden">
      {items.map((item) => (
        <Link key={item.label} to={item.to} className="flex flex-col items-center justify-center text-[0.68rem] leading-tight">
          <span className="mb-0.5 text-[1.5rem] leading-none" aria-hidden="true">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const embed = useEmbed();
  const onGame = useRouterState({ select: (st) => st.location.pathname.startsWith("/games/") });
  const onSportsMatch = useRouterState({
    select: (st) => /^\/sports\/[^/]+\/[^/]+\/?$/.test(st.location.pathname),
  });

  return (
    <QueryClientProvider client={queryClient}>
      <div className={embed ? "min-h-dvh bg-table-felt" : "min-h-screen bg-background"}>
        {embed ? null : onGame ? (
          <>
            <GameTopBar />
            <div className="hidden sm:block"><SiteHeader /></div>
          </>
        ) : onSportsMatch ? (
          <>
            <SportsTopBar />
            <div className="hidden sm:block"><SiteHeader /></div>
          </>
        ) : <SiteHeader />}
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        {embed || !onSportsMatch ? null : <SportsBottomNav />}
        <WinCelebration />
      </div>
    </QueryClientProvider>
  );
}

