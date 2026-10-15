import { describe, expect, it, vi } from "vitest";
import { notifyPsaReadingsChanged, subscribePsaReadingsChanged } from "./psaReadingsSignal";

describe("psaReadingsSignal", () => {
  it("calls every subscriber on notify", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribePsaReadingsChanged(a);
    const offB = subscribePsaReadingsChanged(b);
    notifyPsaReadingsChanged();
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    offA();
    offB();
  });

  it("stops calling a subscriber after it unsubscribes", () => {
    const a = vi.fn();
    const off = subscribePsaReadingsChanged(a);
    off();
    notifyPsaReadingsChanged();
    expect(a).not.toHaveBeenCalled();
  });

  it("tolerates a subscriber that unsubscribes while being notified", () => {
    const later = vi.fn();
    let offFirst = () => {};
    offFirst = subscribePsaReadingsChanged(() => offFirst());
    const offLater = subscribePsaReadingsChanged(later);
    notifyPsaReadingsChanged();
    expect(later).toHaveBeenCalledOnce();
    offLater();
  });
});
