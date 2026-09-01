import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoginSplash } from "../login-splash";

describe("LoginSplash", () => {
  it("zobrazí video vycentrované v poloviční velikosti a text Přihlašuji se", () => {
    const { container } = render(<LoginSplash show />);

    const video = document.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.getAttribute("src")).toBe("/realflip-animation.mp4");
    expect(video?.getAttribute("poster")).toBe("/realflip-animation-poster.jpg");
    // video je v poloviční velikosti okna, vycentrované, bez ořezu (object-contain)
    const box = container.querySelector(".h-\\[50vh\\]");
    expect(box).toBeTruthy();
    expect(box?.className).toContain("w-[50vw]");
    expect(video?.className).toContain("object-contain");
    expect(video?.loop).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.getAttribute("autoplay")).not.toBeNull();
    expect(video?.getAttribute("playsinline")).not.toBeNull();
    expect(screen.getByText("Přihlašuji se…")).toBeTruthy();
  });

  it("po prvním celém průchodu videa zavolá onPlayedOnce", () => {
    const onPlayedOnce = vi.fn();
    render(<LoginSplash show onPlayedOnce={onPlayedOnce} />);

    const video = document.querySelector("video")!;
    Object.defineProperty(video, "duration", { value: 10 });
    Object.defineProperty(video, "currentTime", { value: 9.9 });
    fireEvent.timeUpdate(video);

    expect(onPlayedOnce).toHaveBeenCalledTimes(1);
  });

  it("onPlayedOnce se zavolá jen jednou i při dalším průchodu (loop)", () => {
    const onPlayedOnce = vi.fn();
    render(<LoginSplash show onPlayedOnce={onPlayedOnce} />);

    const video = document.querySelector("video")!;
    Object.defineProperty(video, "duration", { value: 10 });
    Object.defineProperty(video, "currentTime", { value: 9.9 });
    fireEvent.timeUpdate(video);
    fireEvent.timeUpdate(video); // druhý průchod — už se nehlásí

    expect(onPlayedOnce).toHaveBeenCalledTimes(1);
  });

  it("onError neprojde dvakrát po timeupdate (sdílený guarded report)", () => {
    const onPlayedOnce = vi.fn();
    render(<LoginSplash show onPlayedOnce={onPlayedOnce} />);

    const video = document.querySelector("video")!;
    Object.defineProperty(video, "duration", { value: 10 });
    Object.defineProperty(video, "currentTime", { value: 9.9 });
    fireEvent.timeUpdate(video); // video domontovalo → hlášeno
    fireEvent.error(video); // chyba těsně nato → už nesmí zavolat podruhé

    expect(onPlayedOnce).toHaveBeenCalledTimes(1);
  });

  it("onError bez přehraného videa ohlásí průchod sám (fallback při chybě src)", () => {
    const onPlayedOnce = vi.fn();
    render(<LoginSplash show onPlayedOnce={onPlayedOnce} />);

    const video = document.querySelector("video")!;
    fireEvent.error(video);

    expect(onPlayedOnce).toHaveBeenCalledTimes(1);
  });

  it("nic nezobrazí, když je show=false", () => {
    render(<LoginSplash show={false} />);

    expect(document.querySelector("video")).toBeNull();
    expect(screen.queryByText("Přihlašuji se…")).toBeNull();
  });
});
