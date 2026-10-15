// @vitest-environment jsdom
// ABOUTME: Checks that the visit-prep brief makes one paid request per visit and explicit attempt:
// ABOUTME: a refreshed plan item, an edit, or Stop followed by a re-render never restarts it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PlanItem } from "@/hooks/usePlanItems";

const streamVisitPrep = vi.fn();

vi.mock("@/demo/visitPrep", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/demo/visitPrep")>()),
  streamVisitPrep: (...args: unknown[]) => streamVisitPrep(...args),
}));
// The real client would build the demo backend; the brief only needs loadRecord to fail soft.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("no backend in this test");
    },
  },
}));

import { setApiKey } from "@/demo/apiKey";
import { VisitPrepBrief } from "./VisitPrepBrief";

const item: PlanItem = {
  id: "visit-1",
  event_date: "2026-11-01",
  title: "Pre-scan check-in",
  body: "Bring questions.",
  status: "Locked",
  sort_index: 0,
  created_at: "",
  updated_at: "",
};
const context = { recentPsa: [], medications: [] };

/** A stream that writes some text, then finishes when `finish` is called or the request aborts. */
function holdOpenStream() {
  let finish: () => void = () => {};
  streamVisitPrep.mockImplementation(
    (_input: unknown, opts: { signal: AbortSignal; onText: (d: string) => void }) =>
      new Promise<void>((resolve) => {
        opts.onText("## What's changed since last visit");
        finish = resolve;
        opts.signal.addEventListener("abort", () => resolve());
      }),
  );
  return () => finish();
}

/** Lets the pending record load and stream start settle. */
const settle = () => act(async () => {});

beforeEach(() => {
  streamVisitPrep.mockReset();
  sessionStorage.clear();
  expect(setApiKey("sk-ant-test")).toBe(true);
});
afterEach(cleanup);

describe("VisitPrepBrief", () => {
  it("asks for a key and makes no request when there is none", async () => {
    sessionStorage.clear();
    render(<VisitPrepBrief item={item} context={context} />);
    await settle();
    expect(screen.getByLabelText("Anthropic API key")).toBeTruthy();
    expect(streamVisitPrep).not.toHaveBeenCalled();
  });

  it("does not restart when the same visit arrives as a new object", async () => {
    holdOpenStream();
    const { rerender } = render(<VisitPrepBrief item={item} context={context} />);
    await settle();
    expect(streamVisitPrep).toHaveBeenCalledTimes(1);

    rerender(<VisitPrepBrief item={{ ...item, updated_at: "later" }} context={context} />);
    rerender(
      <VisitPrepBrief
        item={{ ...item }}
        context={{ recentPsa: [{ date: "2026-10-01", value: 0.1 }], medications: [] }}
      />,
    );
    await settle();
    expect(streamVisitPrep).toHaveBeenCalledTimes(1);
  });

  it("keeps the brief and offers Regenerate after the visit is edited, restarting only on click", async () => {
    const finish = holdOpenStream();
    const { rerender } = render(<VisitPrepBrief item={item} context={context} />);
    await settle();
    await act(async () => finish());
    expect(screen.queryByText("Regenerate")).toBeNull();

    rerender(
      <VisitPrepBrief item={{ ...item, body: "Bring the scan report." }} context={context} />,
    );
    await settle();
    expect(streamVisitPrep).toHaveBeenCalledTimes(1);
    const regenerate = screen.getByText("Regenerate");

    holdOpenStream();
    fireEvent.click(regenerate);
    await settle();
    expect(streamVisitPrep).toHaveBeenCalledTimes(2);
    expect(streamVisitPrep.mock.calls[1][0].planItem.body).toBe("Bring the scan report.");
  });

  it("stays stopped after Stop, even across a re-render", async () => {
    holdOpenStream();
    const { rerender } = render(<VisitPrepBrief item={item} context={context} />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await settle();
    expect(screen.getByText(/Stopped/)).toBeTruthy();

    rerender(<VisitPrepBrief item={{ ...item, updated_at: "later" }} context={context} />);
    await settle();
    expect(streamVisitPrep).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Stopped/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("starts a new brief for a different visit", async () => {
    holdOpenStream();
    const { rerender } = render(<VisitPrepBrief item={item} context={context} />);
    await settle();
    rerender(<VisitPrepBrief item={{ ...item, id: "visit-2" }} context={context} />);
    await settle();
    expect(streamVisitPrep).toHaveBeenCalledTimes(2);
  });
});
