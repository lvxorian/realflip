import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PropertyActionBar } from "../property-action-bar";

describe("PropertyActionBar — mobilní spodní akční bar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("vyrendruje Zavolat (link s telefonem), Sdílet a Oblíbené", () => {
    render(
      <PropertyActionBar
        propertyId="p1"
        title="Byt 2+kk Praha"
        url="https://x.cz/a"
        phone="+420 608 033 397"
        initialFavorited={false}
      />
    );

    expect(screen.getByRole("link", { name: /zavolat/i })).toBeTruthy();
    expect(screen.getByLabelText("Sdílet nemovitost")).toBeTruthy();
    expect(screen.getByLabelText("Přidat do oblíbených")).toBeTruthy();
  });

  it("bez telefonu se Zavolat nerenďruje jako odkaz", () => {
    render(
      <PropertyActionBar propertyId="p1" title="Byt" url={null} phone={null} initialFavorited={false} />
    );

    expect(screen.queryByRole("link", { name: /zavolat/i })).toBeNull();
  });

  it("sdílení kopíruje odkaz do schránky (fallback bez Web Share API)", async () => {
    render(
      <PropertyActionBar propertyId="p1" title="Byt" url="https://x.cz/a" phone={null} initialFavorited={false} />
    );

    fireEvent.click(screen.getByLabelText("Sdílet nemovitost"));

    await waitFor(() =>
      expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith("https://x.cz/a")
    );
  });
});
