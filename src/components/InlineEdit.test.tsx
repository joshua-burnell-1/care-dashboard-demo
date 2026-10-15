// @vitest-environment jsdom
// ABOUTME: InlineEdit's contract: a labelled pencil opens labelled fields with focus on the first,
// ABOUTME: Enter commits and shows the new value at once, a failed save rolls back, Escape cancels.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { InlineEdit, type InlineField } from "./InlineEdit";

type Med = { id: string; item: string; dose: string; purpose: string };
const med: Med = { id: "m1", item: "Vitamin D3", dose: "1,000 IU", purpose: "Bone health" };
const fields: InlineField<Med>[] = [
  { name: "item", label: "Name", required: true },
  { name: "dose", label: "Dose" },
  { name: "purpose", label: "Purpose", type: "textarea" },
];

function Row({ value, onSave }: { value: Med; onSave: (n: Med, p: Med) => Promise<void> }) {
  return (
    <InlineEdit value={value} fields={fields} subject={value.item} onSave={onSave}>
      {(shown, pencil) => (
        <div>
          <span data-testid="dose">{shown.dose}</span>
          {pencil}
        </div>
      )}
    </InlineEdit>
  );
}

function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(cleanup);

describe("InlineEdit", () => {
  it("opens labelled fields from a named pencil and focuses the first", () => {
    render(<Row value={med} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Vitamin D3" }));
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Vitamin D3");
    expect(screen.getByLabelText("Dose")).toHaveProperty("value", "1,000 IU");
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
  });

  it("Escape cancels without saving and returns focus to the pencil", () => {
    const onSave = vi.fn();
    render(<Row value={med} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Vitamin D3" }));
    fireEvent.change(screen.getByLabelText("Dose"), { target: { value: "5 IU" } });
    fireEvent.keyDown(screen.getByLabelText("Dose"), { key: "Escape" });
    expect(screen.queryByLabelText("Dose")).toBeNull();
    expect(screen.getByTestId("dose").textContent).toBe("1,000 IU");
    expect(onSave).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit Vitamin D3" }));
  });

  it("Enter commits, shows the new value while saving, and returns focus to the pencil", async () => {
    const save = deferred();
    const onSave = vi.fn(() => save.promise);
    render(<Row value={med} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Vitamin D3" }));
    fireEvent.change(screen.getByLabelText("Dose"), { target: { value: " 2,000 IU " } });
    fireEvent.keyDown(screen.getByLabelText("Dose"), { key: "Enter" });

    expect(onSave).toHaveBeenCalledWith({ ...med, dose: "2,000 IU" }, med);
    expect(screen.getByTestId("dose").textContent).toBe("2,000 IU");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit Vitamin D3" }));
    await act(async () => save.resolve());
  });

  it("rolls back to the old value when the save fails", async () => {
    const save = deferred();
    render(<Row value={med} onSave={() => save.promise} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Vitamin D3" }));
    fireEvent.change(screen.getByLabelText("Dose"), { target: { value: "2,000 IU" } });
    fireEvent.keyDown(screen.getByLabelText("Dose"), { key: "Enter" });
    expect(screen.getByTestId("dose").textContent).toBe("2,000 IU");
    await act(async () => save.reject(new Error("offline")));
    expect(screen.getByTestId("dose").textContent).toBe("1,000 IU");
  });

  it("takes Enter as a new line in a text area, and Ctrl+Enter as Save", () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(<Row value={med} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Vitamin D3" }));
    const purpose = screen.getByLabelText("Purpose");
    fireEvent.change(purpose, { target: { value: "Bones and mood" } });
    fireEvent.keyDown(purpose, { key: "Enter" });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(purpose, { key: "Enter", ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith({ ...med, purpose: "Bones and mood" }, med);
  });

  it("closes without saving when nothing changed", () => {
    const onSave = vi.fn();
    render(<Row value={med} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Vitamin D3" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Dose")).toBeNull();
  });
});
