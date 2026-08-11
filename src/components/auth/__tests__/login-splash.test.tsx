import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginSplash } from "../login-splash";

describe("LoginSplash", () => {
  it("zobrazí video animaci a text Přihlašuji se, když je show=true", () => {
    render(<LoginSplash show />);

    const video = document.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.getAttribute("src")).toBe("/realflip-animation.mp4");
    expect(video?.getAttribute("poster")).toBe("/realflip-animation-poster.jpg");
    expect(video?.loop).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.getAttribute("autoplay")).not.toBeNull();
    expect(video?.getAttribute("playsinline")).not.toBeNull();
    expect(screen.getByText("Přihlašuji se…")).toBeTruthy();
  });

  it("nic nezobrazí, když je show=false", () => {
    render(<LoginSplash show={false} />);

    expect(document.querySelector("video")).toBeNull();
    expect(screen.queryByText("Přihlašuji se…")).toBeNull();
  });
});
