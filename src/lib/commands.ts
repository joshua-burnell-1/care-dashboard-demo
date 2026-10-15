// ABOUTME: The command palette's list: every page, lab result, plan item and document as a
// ABOUTME: navigation command, plus the global actions. Pure data; the palette supplies the handlers.
import { metricSlug } from "./labs";
import { NAV_ITEMS } from "./nav";

export type CommandGroup = "Pages" | "Lab results" | "Plan" | "Documents" | "Actions";

export type Command = {
  id: string;
  group: CommandGroup;
  label: string;
  keywords?: string[];
  /** Path to navigate to when picked. */
  to?: string;
  /** Runs when picked, for commands that are not plain navigation. */
  run?: () => void;
};

export type ActionId =
  | "ask-assistant"
  | "upload-document"
  | "add-psa-reading"
  | "toggle-theme"
  | "reset-demo"
  | "take-tour";

export type CommandHandlers = Partial<Record<ActionId, () => void>>;

export type CommandData = {
  metrics: string[];
  planItems: { id: string; title: string }[];
  documents: { id: string; name: string }[];
};

const ACTIONS: { id: ActionId; label: string; keywords: string[] }[] = [
  { id: "ask-assistant", label: "Ask the assistant", keywords: ["chat", "question", "help", "ai"] },
  { id: "upload-document", label: "Upload a document", keywords: ["file", "scan", "add", "pdf"] },
  { id: "add-psa-reading", label: "Add PSA reading", keywords: ["lab", "new", "record", "psa"] },
  { id: "toggle-theme", label: "Toggle theme", keywords: ["dark", "light", "mode", "appearance"] },
  { id: "reset-demo", label: "Reset demo data", keywords: ["restore", "seed", "clear"] },
  { id: "take-tour", label: "Take the tour", keywords: ["intro", "onboarding", "walkthrough"] },
];

/**
 * Every command the palette can offer. Actions get their `run` from `handlers`; an action with
 * no handler has none, and the palette leaves it out (for example Reset outside the demo).
 */
export function buildCommands(data: CommandData, handlers: CommandHandlers = {}): Command[] {
  const commands: Command[] = NAV_ITEMS.map((item) => ({
    id: `page:${item.to}`,
    group: "Pages",
    label: item.label,
    to: item.to,
  }));

  const seen = new Set<string>();
  for (const metric of data.metrics) {
    const slug = metricSlug(metric);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    commands.push({ id: `lab:${slug}`, group: "Lab results", label: metric, to: `/labs/${slug}` });
  }

  for (const item of data.planItems) {
    commands.push({
      id: `plan:${item.id}`,
      group: "Plan",
      label: item.title,
      to: `/plan/${item.id}`,
    });
  }

  for (const doc of data.documents) {
    commands.push({
      id: `doc:${doc.id}`,
      group: "Documents",
      label: doc.name,
      to: `/documents/${doc.id}`,
    });
  }

  for (const action of ACTIONS) {
    commands.push({
      id: `action:${action.id}`,
      group: "Actions",
      label: action.label,
      keywords: action.keywords,
      run: handlers[action.id],
    });
  }

  return commands;
}

/**
 * How well a command matches what was typed, for the palette's filter: 0 means hide it. Every
 * word typed must match somewhere. A label match beats a keyword match, and within a label the
 * start of the label beats the start of a word beats the middle of a word. Predictable, with no
 * fuzzy skipping, so "tour" finds "Take the tour" and not a lab name with scattered t, o, u, r.
 */
export function scoreCommand(label: string, query: string, keywords: string[] = []): number {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  const text = label.toLowerCase();
  const extras = keywords.map((k) => k.toLowerCase());
  let total = 0;
  for (const word of words) {
    let best = 0;
    const at = text.indexOf(word);
    if (at === 0) best = 1;
    else if (at > 0) best = /[^a-z0-9]/.test(text[at - 1]) ? 0.8 : 0.6;
    if (best === 0) {
      for (const extra of extras) {
        const i = extra.indexOf(word);
        if (i === -1) continue;
        best = Math.max(best, i === 0 || /[^a-z0-9]/.test(extra[i - 1]) ? 0.4 : 0.3);
      }
    }
    if (best === 0) return 0;
    total += best;
  }
  // Shorter labels first among equal matches.
  return total / words.length - Math.min(text.length, 200) * 0.0001;
}
