// ABOUTME: Turns save, delete and undo failures into a sentence for people. Raw database or edge
// ABOUTME: function text is never shown; anything unrecognised becomes a plain "try again".

const MESSAGES: [RegExp, string][] = [
  [/took too long/i, "That took too long. Try again."],
  [/not found|no longer exists|PGRST116|0 rows/i, "That item no longer exists."],
  [/already|duplicate key|23505|restore failed/i, "That item is already in the record."],
  [/invalid date/i, "Use a valid date."],
  [/invalid value/i, "Use a number for the value."],
  [/invalid (item name|name|title|label|metric)/i, "Give it a name."],
  [/invalid (phase|status|tone|table)/i, "Pick one of the listed options."],
  [/too long/i, "That text is too long."],
  [/failed to fetch|network|load failed|failed to send/i, "Could not reach the server. Try again."],
  [/non-2xx/i, "The server turned that change down. Check the fields and try again."],
];

const FALLBACK = "Something went wrong. Try again.";

/** A sentence for a failure, from an Error, a message or an edge function's error body. */
export function humanError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof (error as { message?: unknown })?.message === "string"
          ? (error as { message: string }).message
          : "";
  return MESSAGES.find(([pattern]) => pattern.test(raw))?.[1] ?? FALLBACK;
}

/**
 * The message from a `supabase.functions.invoke` failure: the body's `error` when there is one
 * (a non-2xx reply keeps its body on `error.context`), else the client error.
 */
export async function invokeErrorText(data: unknown, error: unknown): Promise<string> {
  const fromBody = (body: unknown) => {
    const e = (body as { error?: unknown } | null)?.error;
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string")
      return (e as { message: string }).message;
    return "";
  };
  const direct = fromBody(data);
  if (direct) return direct;
  const context = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (context?.json) {
    try {
      const body = fromBody(await context.json());
      if (body) return body;
    } catch {
      // Not JSON: fall back to the client error.
    }
  }
  return error instanceof Error
    ? error.message
    : String((error as { message?: unknown })?.message ?? "");
}
