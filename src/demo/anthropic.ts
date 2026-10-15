// ABOUTME: Shared Anthropic helpers for the demo's bring-your-own-key features.
// ABOUTME: Client factory, model and fallback settings, and SDK-error to message mapping.

import Anthropic, {
  APIConnectionError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";

export const DEMO_MODEL = "claude-opus-5-5";

export type DemoAiErrorCode =
  "NO_API_KEY" | "BAD_KEY" | "RATE_LIMIT" | "REFUSAL" | "NETWORK" | "API";

export type DemoAiError = { error: string; code: DemoAiErrorCode };

/** Server-side refusal fallback; spread into every `beta.messages.create` request. */
export const FALLBACK_PARAMS: {
  betas: Anthropic.Beta.AnthropicBeta[];
  fallbacks: Anthropic.Beta.Messages.BetaFallbacksParam;
} = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

/** A client that calls api.anthropic.com straight from the browser with the viewer's key. */
export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/** Turns anything thrown by the SDK into a message safe to show the viewer. Never includes the key. */
export function mapAnthropicError(e: unknown): DemoAiError {
  if (e instanceof AuthenticationError) {
    return { error: "That API key was rejected. Check it and try again.", code: "BAD_KEY" };
  }
  if (e instanceof RateLimitError) {
    return {
      error: "Anthropic is rate limiting this key. Wait a moment and try again.",
      code: "RATE_LIMIT",
    };
  }
  if (e instanceof APIConnectionError) {
    return {
      error: "Could not reach Anthropic. Check your connection and try again.",
      code: "NETWORK",
    };
  }
  if (e instanceof APIError) {
    return { error: `Anthropic returned an error (status ${e.status ?? "unknown"}).`, code: "API" };
  }
  return { error: "Something went wrong talking to Anthropic.", code: "API" };
}
