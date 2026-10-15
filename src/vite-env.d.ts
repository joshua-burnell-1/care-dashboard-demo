/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "false" switches to a real Supabase project (needs both vars below); anything else runs the demo. */
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Real mode only: the Supabase auth user whose password the family shares. */
  readonly VITE_AUTH_EMAIL?: string;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
