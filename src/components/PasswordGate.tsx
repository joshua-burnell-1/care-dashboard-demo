import { useState, useEffect, type ReactNode } from "react";
import { supabase, demoDb } from "@/integrations/supabase/client";
import { AppMark } from "@/components/AppMark";

export const PASSWORD_STORAGE_KEY = "care_dashboard_pw";
/** The shared Supabase auth user the family password belongs to (see .env.example). */
const AUTH_EMAIL: string = import.meta.env.VITE_AUTH_EMAIL ?? "";

/** In demo mode there is nothing to protect: the data is fictional and lives in the browser. */
export function PasswordGate({ children }: { children: (pw: string) => ReactNode }) {
  if (demoDb) return <>{children("demo")}</>;
  return <RealPasswordGate>{children}</RealPasswordGate>;
}

function RealPasswordGate({ children }: { children: (pw: string) => ReactNode }) {
  const [pw, setPw] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const stored = localStorage.getItem(PASSWORD_STORAGE_KEY);
        if (stored) setPw(stored);
        else supabase.auth.signOut();
      }
      setLoading(false);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!AUTH_EMAIL) {
      setError("Sign-in is not configured (VITE_AUTH_EMAIL is missing).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: AUTH_EMAIL,
        password: input,
      });
      if (authErr) {
        setError("Incorrect password.");
      } else {
        localStorage.setItem(PASSWORD_STORAGE_KEY, input);
        setPw(input);
      }
    } catch {
      setError("Could not verify. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;
  if (pw) return <>{children(pw)}</>;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.17 0.025 70) 0%, oklch(0.21 0.045 200) 55%, oklch(0.19 0.06 240) 100%)",
      }}
    >
      {/* Ambient glow layers */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 25% 45%, oklch(0.38 0.09 75 / 0.35) 0%, transparent 55%), radial-gradient(ellipse at 75% 25%, oklch(0.38 0.11 200 / 0.25) 0%, transparent 50%)",
        }}
      />

      <form onSubmit={submit} className="relative z-10 w-full max-w-sm">
        <div
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 ring-1 ring-white/60"
          style={{ boxShadow: "0 8px 16px rgba(0,0,0,0.15), 0 32px 64px rgba(0,0,0,0.25)" }}
        >
          <div className="flex justify-center mb-5">
            <AppMark className="h-16 w-16" />
          </div>

          <h1 className="text-xl font-bold text-stone-900 text-center tracking-tight">
            Care Dashboard
          </h1>
          <p className="text-sm text-stone-500 mt-1.5 text-center leading-relaxed">
            Family access · Enter the shared password
          </p>

          <div className="mt-6 space-y-3">
            <input
              type="password"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition placeholder:text-stone-400"
              placeholder="Password"
            />
            {error && (
              <p className="text-xs text-rose-600 flex items-center gap-1.5">
                <span className="inline-block w-1 h-1 rounded-full bg-rose-500" />
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !input}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition disabled:opacity-50"
              style={{
                background:
                  loading || !input
                    ? "oklch(0.5 0 0)"
                    : "linear-gradient(135deg, oklch(0.22 0.02 70) 0%, oklch(0.26 0.04 200) 100%)",
                boxShadow: loading || !input ? "none" : "0 2px 8px rgba(0,0,0,0.25)",
              }}
            >
              {loading ? "Checking…" : "Enter dashboard"}
            </button>
          </div>
        </div>

        <p className="text-center text-white/30 text-xs mt-4">
          Not medical advice · For family only
        </p>
      </form>
    </div>
  );
}
