import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in | Universal API console" },
      {
        name: "description",
        content:
          "Sign in to the Universal API console to manage operators, API keys, whitelists and round results.",
      },
      { property: "og:title", content: "Sign in | Universal API console" },
      {
        property: "og:description",
        content: "Operator and admin sign-in for the Universal API casino and sports platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Admin -> /console, operator (or anyone else) -> /operator. */
  const goToPanel = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    void navigate({ to: data ? "/console" : "/operator", replace: true });
  };

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goToPanel(data.session.user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (res.error) {
      setMsg(res.error.message);
      return;
    }
    if (res.data.session) void goToPanel(res.data.session.user.id);
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[420px] flex-col justify-center px-4">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Universal API operator console</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Please wait…" : "Sign in"}
          </button>
        </form>
        {msg ? <p className="mt-3 text-sm text-destructive">{msg}</p> : null}
        <p className="mt-4 text-xs text-muted-foreground">
          Accounts are created by the admin. Access ke liye apne admin se contact karein.
        </p>
      </div>
    </div>
  );
}
