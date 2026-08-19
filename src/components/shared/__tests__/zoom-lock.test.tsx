import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ZoomLock } from "../zoom-lock";

describe("ZoomLock — blokace pinch/double-tap zoomu", () => {
  it("dvojprstý touchmove je preventDefault, jednovrstý zůstává scroll", () => {
    render(<ZoomLock />);

    const twoTouch = new Event("touchmove", { cancelable: true, bubbles: true });
    Object.defineProperty(twoTouch, "touches", { value: [{}, {}] });
    document.body.dispatchEvent(twoTouch);
    expect(twoTouch.defaultPrevented).toBe(true);

    const oneTouch = new Event("touchmove", { cancelable: true, bubbles: true });
    Object.defineProperty(oneTouch, "touches", { value: [{}] });
    document.body.dispatchEvent(oneTouch);
    expect(oneTouch.defaultPrevented).toBe(false);
  });

  it("vnitřek mapy (leaflet-container) si pinch nechává", () => {
    render(<ZoomLock />);
    const map = document.createElement("div");
    map.className = "leaflet-container";
    document.body.appendChild(map);

    const ev = new Event("touchmove", { cancelable: true, bubbles: true });
    Object.defineProperty(ev, "touches", { value: [{}, {}] });
    map.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);

    map.remove();
  });

  it("iOS gesture events se blokují", () => {
    render(<ZoomLock />);

    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
      const ev = new Event(type, { cancelable: true, bubbles: true });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    }
  });
});
