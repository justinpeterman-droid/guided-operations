import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUnsavedChanges } from "./use-unsaved-changes";
function Form({ dirty }: { dirty: boolean }) {
  useUnsavedChanges(dirty);
  return <a href="/policy-expert">Policy</a>;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("unsaved entry protection", () => {
  it("guards cancellable same-document Back and Forward and removes the listener after saving", () => {
    const navigation = new EventTarget();
    vi.stubGlobal("navigation", navigation);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = render(<Form dirty />);
    function navigate(
      cancelable = true,
      url = "http://localhost/home",
      type = "traverse",
    ) {
      const event = Object.assign(new Event("navigate", { cancelable }), {
        navigationType: type,
        destination: { url, sameDocument: true },
      });
      navigation.dispatchEvent(event);
      return event;
    }
    expect(navigate().defaultPrevented).toBe(true);
    expect(navigate(false).defaultPrevented).toBe(false);
    expect(
      navigate(true, window.location.href + "#details").defaultPrevented,
    ).toBe(false);
    expect(
      navigate(true, "http://localhost/home", "push").defaultPrevented,
    ).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    confirm.mockReturnValue(true);
    expect(navigate().defaultPrevented).toBe(false);
    view.rerender(<Form dirty={false} />);
    confirm.mockClear();
    navigate();
    expect(confirm).not.toHaveBeenCalled();
  });
  it("cancels a same-tab link and reload until the work is saved", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = render(<Form dirty />);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    view.getByText("Policy").dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
    const reload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(reload);
    expect(reload.defaultPrevented).toBe(true);
    view.rerender(<Form dirty={false} />);
    const savedReload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(savedReload);
    expect(savedReload.defaultPrevented).toBe(false);
  });
  it("does not interrupt opening another tab or moving to an anchor", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = render(<Form dirty />);
    const link = view.getByText("Policy");
    // Prevent jsdom navigation after the capture listener has been evaluated.
    link.addEventListener("click", (e) => e.preventDefault());
    link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      }),
    );
    link.setAttribute("href", "#form");
    link.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(confirm).not.toHaveBeenCalled();
  });
});
