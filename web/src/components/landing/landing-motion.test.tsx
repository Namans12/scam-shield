import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageSquareText, Image } from "lucide-react";
import { InputCarousel } from "./InputCarousel";
import { ScrollFlow } from "./ScrollFlow";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { setLang } from "@/i18n";

const items = ["a", "b", "c", "d", "e"].map((id, i) => ({ id, icon: i % 2 ? Image : MessageSquareText, title: `Title ${id}`, description: `Desc ${id}`, visual: <i /> }));

beforeEach(() => setLang("en"));
afterEach(() => vi.restoreAllMocks());

describe("LanguageToggle", () => {
  it("uses equal columns and moves the pill by whole segments, so it always covers the chosen label", async () => {
    const user = userEvent.setup();
    const { container } = render(<LanguageToggle />);
    const group = container.querySelector("[role=radiogroup]") as HTMLElement;
    const pill = container.querySelector(".segmented-indicator") as HTMLElement;
    expect(group.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(pill.style.transform).toBe("translateX(0%)");
    expect(pill.style.width).toMatch(/^calc\((0\.5 \* \(100% - 4px\)|\(100% - 4px\) \/ 2)\)$/);
    await user.click(screen.getByRole("radio", { name: "हिंदी" }));
    expect(pill.style.transform).toBe("translateX(100%)");
  });
});

describe("InputCarousel", () => {
  // jsdom has no layout: fake a 600px track holding five 300px-pitch cards, so it can scroll 900px and the 4th and 5th
  // cards cannot both reach the start edge (the classic carousel trap).
  const scrollTo = vi.fn();
  beforeEach(() => {
    scrollTo.mockClear();
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => 1500 });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 600 });
    Object.defineProperty(HTMLElement.prototype, "offsetLeft", { configurable: true, get(this: HTMLElement) { return this.parentElement ? [...this.parentElement.children].indexOf(this) * 300 : 0; } });
    HTMLElement.prototype.scrollTo = scrollTo as never;
  });
  afterEach(() => {
    for (const key of ["scrollWidth", "clientWidth", "offsetLeft", "scrollTo"]) Reflect.deleteProperty(HTMLElement.prototype, key);
    Reflect.deleteProperty(window, "matchMedia");
  });

  const setup = () => {
    const view = render(<><h2 id="h">Things</h2><InputCarousel labelledBy="h" items={items} /></>);
    const track = view.container.querySelector(".carousel-track") as HTMLElement;
    const active = () => screen.getAllByRole("group").findIndex((g) => g.getAttribute("data-current") === "true");
    const activeDot = () => screen.getAllByRole("button", { name: /^Show Title/ }).findIndex((d) => d.getAttribute("aria-current") === "true");
    return { ...view, track, active, activeDot };
  };
  const scrollUser = async (track: HTMLElement, left: number, active: () => number, expected: number) => {
    Object.defineProperty(track, "scrollLeft", { configurable: true, writable: true, value: left });
    fireEvent.scroll(track);
    await waitFor(() => expect(active()).toBe(expected));
  };

  it("is a labelled carousel of numbered slides with one dot per slide", () => {
    setup();
    expect(screen.getByRole("region", { name: "Things" })).toHaveAttribute("aria-roledescription", "carousel");
    expect(screen.getAllByRole("group")).toHaveLength(5);
    expect(screen.getByRole("group", { name: "2 of 5" })).toHaveAttribute("aria-roledescription", "slide");
    expect(screen.getAllByRole("button", { name: /^Show Title/ })).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("starts on the first card at the start of the track and never moves by itself", () => {
    vi.useFakeTimers();
    try {
      const { active, activeDot } = setup();
      vi.advanceTimersByTime(30_000);
      expect(scrollTo).not.toHaveBeenCalled();
      expect(active()).toBe(0);
      expect(activeDot()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves the highlighted card and the dot with Next, the arrow keys, Home/End and the dots", async () => {
    const user = userEvent.setup();
    const { track, active, activeDot } = setup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect([active(), activeDot()]).toEqual([1, 1]);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: "smooth" });
    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(active()).toBe(2);
    fireEvent.keyDown(track, { key: "ArrowLeft" });
    expect(active()).toBe(1);
    fireEvent.keyDown(track, { key: "End" });
    expect(active()).toBe(4);
    fireEvent.keyDown(track, { key: "Home" });
    expect(active()).toBe(0);
    await user.click(screen.getByRole("button", { name: "Show Title c" }));
    expect([active(), activeDot()]).toEqual([2, 2]);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 600, behavior: "smooth" });
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(active()).toBe(1);
  });

  it("can highlight the first and the last card, and Previous works from the last card even though the track cannot scroll further", async () => {
    const user = userEvent.setup();
    const { active, activeDot } = setup();
    const next = screen.getByRole("button", { name: "Next" });
    const prev = screen.getByRole("button", { name: "Previous" });
    for (let i = 1; i <= 4; i += 1) {
      await user.click(next);
      expect(active()).toBe(i);
    }
    expect(screen.getByRole("group", { name: "5 of 5" })).toHaveAttribute("data-current", "true");
    expect(next).toBeDisabled();
    expect(prev).toBeEnabled();
    // cards 4 and 5 both scroll to the track's end (900), yet each is the active one in turn
    expect(scrollTo).toHaveBeenNthCalledWith(3, { left: 900, behavior: "smooth" });
    expect(scrollTo).toHaveBeenNthCalledWith(4, { left: 900, behavior: "smooth" });
    await user.click(prev);
    expect([active(), activeDot()]).toEqual([3, 3]);
    expect(next).toBeEnabled();
    for (let i = 2; i >= 0; i -= 1) {
      await user.click(prev);
      expect(active()).toBe(i);
    }
    expect(prev).toBeDisabled();
  });

  it("makes a clicked card the active one", async () => {
    const user = userEvent.setup();
    const { active } = setup();
    await user.click(screen.getByRole("group", { name: "4 of 5" }));
    expect(active()).toBe(3);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("group", { name: "4 of 5" }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("follows the card most in view when the user scrolls or swipes, with the first and last card at the track's ends", async () => {
    const { track, active, activeDot } = setup();
    await scrollUser(track, 320, active, 1);
    await scrollUser(track, 580, active, 2);
    await scrollUser(track, 899.5, active, 4);
    expect(activeDot()).toBe(4);
    await scrollUser(track, 0.4, active, 0);
  });

  it("keeps the card chosen with a button while the track is still scrolling to it", async () => {
    const user = userEvent.setup();
    const { track, active } = setup();
    await user.click(screen.getByRole("button", { name: "Show Title d" }));
    // intermediate scroll events of the smooth scroll must not change the highlight
    Object.defineProperty(track, "scrollLeft", { configurable: true, writable: true, value: 450 });
    fireEvent.scroll(track);
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    expect(active()).toBe(3);
  });

  it("scrolls without animation when reduced motion is preferred", async () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as unknown as typeof window.matchMedia;
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: "auto" });
  });
});

describe("ScrollFlow", () => {
  afterEach(() => Reflect.deleteProperty(window, "matchMedia"));
  const flow = [1, 2, 3].map((n) => ({ id: String(n), icon: MessageSquareText, title: `Step ${n}`, description: `Body ${n}` }));

  it("renders an ordered, labelled list whose text is always present", () => {
    render(<><h2 id="h">Steps</h2><ScrollFlow variant="steps" labelledBy="h" items={flow} /></>);
    const list = screen.getByRole("list", { name: "Steps" });
    expect(list.tagName).toBe("OL");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Body 2")).toBeVisible();
  });

  it("shows every step as reached at once with reduced motion", () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as unknown as typeof window.matchMedia;
    render(<><h2 id="h">Steps</h2><ScrollFlow variant="cards" labelledBy="h" items={flow} /></>);
    expect(screen.getAllByRole("listitem").every((li) => li.getAttribute("data-reached") === "true")).toBe(true);
    expect((screen.getByRole("list") as HTMLElement).style.getPropertyValue("--flow")).toBe("1");
  });
});

import { LangStack, LangText } from "./LangStack";

describe("LangStack", () => {
  it("renders both languages in one cell, shows the active one and hides the other from assistive tech", () => {
    const { container } = render(<LangText k="landing.title" />);
    const slots = [...container.querySelectorAll(".lang-slot")] as HTMLElement[];
    expect(slots.map((s) => s.lang)).toEqual(["en", "hi"]);
    expect(slots[0]!.dataset.active).toBe("true");
    expect(slots[0]!.getAttribute("aria-hidden")).toBeNull();
    expect(slots[1]!.dataset.active).toBe("false");
    expect(slots[1]!.getAttribute("aria-hidden")).toBe("true");
    expect(slots[0]!.textContent).toContain("Pause. Check.");
    expect(slots[1]!.textContent).toContain("रुकें");
  });

  it("switches the active language without changing the number of slots", () => {
    const { container, rerender } = render(<LangStack>{(l) => l}</LangStack>);
    setLang("hi");
    rerender(<LangStack>{(l) => l}</LangStack>);
    const slots = [...container.querySelectorAll(".lang-slot")] as HTMLElement[];
    expect(slots).toHaveLength(2);
    expect(slots[1]!.dataset.active).toBe("true");
  });
});
