// ABOUTME: Save with a five-second Undo: one shared "Saved" toast whose Undo reverts the last edit.
// ABOUTME: Saves and undos run one at a time, each with a time limit, and a newer edit retires
// ABOUTME: the older edit's Undo.
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { humanError } from "@/lib/humanError";

/** Every Saved and Undone toast shares this id, so only one is ever on screen. */
export const SAVE_TOAST_ID = "undoable-save";
/**
 * Failures use their own id, so a later Saved toast cannot silently replace the news that an
 * earlier save failed.
 */
export const SAVE_ERROR_TOAST_ID = "undoable-save-error";

const UNDO_WINDOW_MS = 5000;
/** A save or undo that has not settled by then counts as failed, so it cannot block the rest. */
export const SAVE_TIMEOUT_MS = 15_000;

/*
 * Shared by every caller, because the toast is shared: the newest edit anywhere owns it.
 * `latest` numbers each edit; an Undo only works while its edit is still the newest, so a second
 * edit within the five seconds replaces the first toast and the first edit can then only be
 * undone from Activity. `queue` runs saves and undos in order, so an Undo never overtakes the
 * save it reverses and two quick edits land in the order they were made.
 */
let latest = 0;
let queue: Promise<unknown> = Promise.resolve();

function withTimeout<R>(op: () => Promise<R>): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The save took too long")), SAVE_TIMEOUT_MS);
    op().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function enqueue<R>(op: () => Promise<R>): Promise<R> {
  const run = queue.then(
    () => withTimeout(op),
    () => withTimeout(op),
  );
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Returns `(next, prev) => Promise<void>`: saves `next`, then shows "Saved" with Undo for five
 * seconds; Undo calls `revert(prev)`. A failed or timed-out save shows an error toast and
 * rejects, so the caller can put its optimistic value back.
 */
export function useUndoableSave<T>(
  save: (value: T) => Promise<T>,
  revert: (prev: T) => Promise<unknown>,
): (next: T, prev: T) => Promise<void> {
  // The latest callbacks, so the returned function stays stable across renders.
  const saveRef = useRef(save);
  const revertRef = useRef(revert);
  useEffect(() => {
    saveRef.current = save;
    revertRef.current = revert;
  });

  return useCallback(async (next: T, prev: T) => {
    const edit = ++latest;
    try {
      await enqueue(() => saveRef.current(next));
    } catch (e) {
      toast.error("Could not save", { id: SAVE_ERROR_TOAST_ID, description: humanError(e) });
      throw e;
    }
    // A newer edit already started; its own toast will say Saved.
    if (edit !== latest) return;

    const undo = () => {
      if (edit !== latest) return;
      latest++; // one Undo per edit, even on a double click
      enqueue(() => revertRef.current(prev)).then(
        () => toast.success("Undone", { id: SAVE_TOAST_ID }),
        (e) =>
          toast.error("Could not undo", { id: SAVE_ERROR_TOAST_ID, description: humanError(e) }),
      );
    };
    toast.success("Saved", {
      id: SAVE_TOAST_ID,
      duration: UNDO_WINDOW_MS,
      action: { label: "Undo", onClick: undo },
    });
  }, []);
}
