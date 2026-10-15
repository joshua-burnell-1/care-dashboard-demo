// ABOUTME: How a prefilled prompt lands in the chat input without destroying what the caregiver
// ABOUTME: already typed.

/** The input's new text: the prompt alone for an empty draft, otherwise the prompt after the draft. */
export function mergePrefill(draft: string, prompt: string): string {
  if (!draft.trim() || draft === prompt) return prompt;
  return draft.includes(prompt) ? draft : `${draft.trimEnd()} ${prompt}`;
}
