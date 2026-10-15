// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import {
  SAVE_ERROR_TOAST_ID,
  SAVE_TIMEOUT_MS,
  SAVE_TOAST_ID,
  useUndoableSave,
} from "./useUndoableSave";

type Med = { id: string; dose: string };
const before: Med = { id: "m1", dose: "1,000 IU" };
const after: Med = { id: "m1", dose: "2,000 IU" };

/** The Undo action of the most recent success toast. */
function lastUndo(): () => void {
  const options = toast.success.mock.calls.at(-1)![1] as {
    action: { label: string; onClick: () => void };
  };
  return options.action.onClick;
}

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
});
afterEach(cleanup);

describe("useUndoableSave", () => {
  it("saves the new value at once and offers Undo in one shared toast for 5 seconds", async () => {
    const save = vi.fn(async (v: Med) => v);
    const revert = vi.fn(async () => undefined);
    const { result } = renderHook(() => useUndoableSave(save, revert));

    await act(() => result.current(after, before));

    expect(save).toHaveBeenCalledWith(after);
    expect(revert).not.toHaveBeenCalled();
    const [message, options] = toast.success.mock.calls[0];
    expect(message).toBe("Saved");
    expect(options).toMatchObject({ id: SAVE_TOAST_ID, duration: 5000 });
    expect(options.action.label).toBe("Undo");

    // Pressing the toast's Undo runs the revert with the value from before the edit.
    await act(async () => options.action.onClick());
    expect(revert).toHaveBeenCalledWith(before);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("Undo calls revert with the previous value, once", async () => {
    const save = vi.fn(async (v: Med) => v);
    const revert = vi.fn(async () => undefined);
    const { result } = renderHook(() => useUndoableSave(save, revert));
    await act(() => result.current(after, before));

    const undo = lastUndo();
    await act(async () => undo());
    // A second click (say, a double click) must not revert twice.
    await act(async () => undo());

    expect(revert).toHaveBeenCalledTimes(1);
    expect(revert).toHaveBeenCalledWith(before);
    expect(toast.success).toHaveBeenLastCalledWith(
      "Undone",
      expect.objectContaining({ id: SAVE_TOAST_ID }),
    );
  });

  it("a second save replaces the first toast and makes its Undo do nothing", async () => {
    const save = vi.fn(async (v: Med) => v);
    const revert = vi.fn(async () => undefined);
    const { result } = renderHook(() => useUndoableSave(save, revert));
    await act(() => result.current(after, before));
    const firstUndo = lastUndo();
    await act(() => result.current({ id: "m1", dose: "3,000 IU" }, after));

    await act(async () => firstUndo());
    expect(revert).not.toHaveBeenCalled();

    await act(async () => lastUndo()());
    expect(revert).toHaveBeenCalledWith(after);
  });

  it("a failed save shows an error toast and rejects so the caller can roll back", async () => {
    const save = vi.fn(async () => {
      throw new Error("Invalid item name");
    });
    const revert = vi.fn(async () => undefined);
    const { result } = renderHook(() => useUndoableSave<Med>(save, revert));

    await act(async () => {
      await expect(result.current(after, before)).rejects.toThrow("Invalid item name");
    });
    expect(toast.success).not.toHaveBeenCalled();
    // In words, and under its own id so a later Saved toast cannot replace it.
    expect(toast.error).toHaveBeenCalledWith(
      "Could not save",
      expect.objectContaining({ id: SAVE_ERROR_TOAST_ID, description: "Give it a name." }),
    );
  });

  it("a failed undo says so", async () => {
    const save = vi.fn(async (v: Med) => v);
    const revert = vi.fn(async () => {
      throw new Error("offline");
    });
    const { result } = renderHook(() => useUndoableSave(save, revert));
    await act(() => result.current(after, before));
    await act(async () => lastUndo()());
    expect(toast.error).toHaveBeenCalledWith(
      "Could not undo",
      expect.objectContaining({
        id: SAVE_ERROR_TOAST_ID,
        description: "Something went wrong. Try again.",
      }),
    );
  });

  it("runs saves and undos one at a time, in order", async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const save = vi.fn(
      (v: Med) =>
        new Promise<Med>((resolve) => {
          order.push(`save ${v.dose}`);
          release = () => resolve(v);
        }),
    );
    const revert = vi.fn(async (v: Med) => {
      order.push(`revert ${v.dose}`);
    });
    const { result } = renderHook(() => useUndoableSave(save, revert));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current(after, before);
      second = result.current({ id: "m1", dose: "3,000 IU" }, after);
    });
    await act(async () => {
      await Promise.resolve();
    });
    // The second save waits for the first to finish.
    expect(order).toEqual(["save 2,000 IU"]);
    await act(async () => {
      release();
      await first;
    });
    await act(async () => {
      release();
      await second;
    });
    expect(order).toEqual(["save 2,000 IU", "save 3,000 IU"]);
    // Only the newest toast is live.
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("gives up on a save that hangs, says so, and lets the next save run", async () => {
    vi.useFakeTimers();
    try {
      const save = vi
        .fn<(v: Med) => Promise<Med>>()
        .mockImplementationOnce(() => new Promise<Med>(() => {}))
        .mockImplementation(async (v) => v);
      const revert = vi.fn(async () => undefined);
      const { result } = renderHook(() => useUndoableSave(save, revert));

      let hung!: Promise<void>;
      let next!: Promise<void>;
      act(() => {
        hung = result.current(after, before);
        next = result.current({ id: "m1", dose: "3,000 IU" }, after);
      });
      const hungResult = hung.catch((e: Error) => e);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS);
      });
      expect(await hungResult).toBeInstanceOf(Error);
      expect(toast.error).toHaveBeenCalledWith(
        "Could not save",
        expect.objectContaining({ description: "That took too long. Try again." }),
      );
      await act(async () => {
        await next;
      });
      expect(save).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith("Saved", expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });
});
