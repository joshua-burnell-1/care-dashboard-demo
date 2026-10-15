// ABOUTME: Decides whether the app runs on the in-browser demo backend. Demo is
// ABOUTME: the default; a real Supabase project needs an explicit opt-out plus creds.

export type DemoModeEnv = {
  VITE_DEMO_MODE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

export function isDemoMode(env: DemoModeEnv): boolean {
  const optedOut = env.VITE_DEMO_MODE === "false";
  const hasCreds = Boolean(env.VITE_SUPABASE_URL) && Boolean(env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return !(optedOut && hasCreds);
}
