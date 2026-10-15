// ABOUTME: "About this demo" dialog for recruiters and curious visitors: what the app is,
// ABOUTME: an architecture diagram, the technical highlights, and a link to the source.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const REPO_URL = "https://github.com/joshua-burnell-1/care-dashboard-demo";

const HIGHLIGHTS = [
  "Realtime-subscribed data hooks: every panel re-reads when its table changes.",
  "Edit history with rollback: each change is logged and can be undone.",
  "Structured-output document extraction: Claude turns an uploaded document into reviewable updates.",
  "Streaming responses: the visit-prep brief appears as Claude writes it, and can be stopped mid-way.",
  "A demo backend that mirrors the edge-function contracts, so the app code is the same as production.",
  "CI runs a secret and identifier scanner on every push, and a private denylist check runs before publishing.",
];

function Box({
  x,
  y,
  w,
  h,
  lines,
  dashed,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  dashed?: boolean;
}) {
  const lineHeight = 16;
  const top = y + h / 2 - ((lines.length - 1) * lineHeight) / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray={dashed ? "6 4" : undefined}
      />
      <text textAnchor="middle" fill="currentColor" fontSize={13} dominantBaseline="middle">
        {lines.map((line, i) => (
          <tspan key={line} x={x + w / 2} y={top + i * lineHeight} fontWeight={i === 0 ? 600 : 400}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/** Browser → mock Supabase → seeded DB, the dashed real-backend path, and the BYOK call to Anthropic. */
function ArchitectureDiagram() {
  return (
    <svg
      viewBox="0 0 640 330"
      role="img"
      aria-labelledby="demo-arch-title demo-arch-desc"
      className="w-full h-auto text-foreground"
    >
      <title id="demo-arch-title">How the demo works</title>
      <desc id="demo-arch-desc">
        Inside your browser, the React app talks to a mock Supabase layer that reads and writes a
        seeded in-memory database. A dashed path shows the real Supabase and edge functions the same
        code would use in production. Chat, extraction and visit-prep call the Anthropic API
        directly from the browser with your own key.
      </desc>
      <defs>
        <marker
          id="demo-arch-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
        </marker>
      </defs>

      {/* The browser boundary */}
      <rect
        x={8}
        y={8}
        width={624}
        height={150}
        rx={12}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.4}
        strokeWidth={1}
      />
      <text x={22} y={28} fill="currentColor" fillOpacity={0.7} fontSize={12}>
        Your browser (everything here runs locally)
      </text>

      <Box x={24} y={54} w={150} h={70} lines={["React app", "UI + hooks"]} />
      <Box x={246} y={54} w={150} h={70} lines={["Mock Supabase", "same client API"]} />
      <Box x={468} y={54} w={150} h={70} lines={["Seeded database", "in memory, fictional"]} />
      <path
        d="M174 89 H246"
        stroke="currentColor"
        strokeWidth={1.5}
        markerEnd="url(#demo-arch-arrow)"
      />
      <path
        d="M396 89 H468"
        stroke="currentColor"
        strokeWidth={1.5}
        markerEnd="url(#demo-arch-arrow)"
      />

      {/* Real backend, dashed: not used in this demo */}
      <Box x={246} y={238} w={150} h={70} lines={["Real Supabase", "+ edge functions"]} dashed />
      <path
        d="M120 124 V273 H246"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray="6 4"
        markerEnd="url(#demo-arch-arrow)"
      />
      <text x={128} y={190} fill="currentColor" fontSize={12} fillOpacity={0.85}>
        <tspan x={128}>Dashed: the real backend path</tspan>
        <tspan x={128} dy={15}>
          (not used in this demo)
        </tspan>
      </text>

      {/* Anthropic, bring your own key */}
      <Box x={468} y={238} w={150} h={70} lines={["Anthropic API", "Claude"]} />
      <path
        d="M543 124 V238"
        stroke="currentColor"
        strokeWidth={1.5}
        markerEnd="url(#demo-arch-arrow)"
      />
      <text x={533} y={186} textAnchor="end" fill="currentColor" fontSize={12} fillOpacity={0.85}>
        <tspan x={533}>Your own API key,</tspan>
        <tspan x={533} dy={15}>
          sent straight from the tab
        </tspan>
      </text>
    </svg>
  );
}

export function AboutDemoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>About this demo</DialogTitle>
          <DialogDescription>
            A family medical dashboard that tracks labs, PSA readings, medications, appointments and
            a care team, with an AI assistant that answers from the patient's record. This is a demo
            copy that runs entirely in your browser on fictional data.
          </DialogDescription>
        </DialogHeader>

        <section aria-labelledby="demo-how-heading" className="space-y-2">
          <h3 id="demo-how-heading" className="text-sm font-semibold">
            How it works
          </h3>
          <ArchitectureDiagram />
        </section>

        <section aria-labelledby="demo-tech-heading" className="space-y-2">
          <h3 id="demo-tech-heading" className="text-sm font-semibold">
            Technical highlights
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {HIGHLIGHTS.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium underline underline-offset-2"
        >
          View the source on GitHub
        </a>
      </DialogContent>
    </Dialog>
  );
}
