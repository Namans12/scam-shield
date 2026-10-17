import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  function withLayout() {
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => 1500 });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 600 });
  }
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollWidth");
    Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  });

  it("is a labelled carousel of numbered slides with one dot per slide", () => {
    withLayout();
    render(<><h2 id="h">Things</h2><InputCarousel labelledBy="h" items={items} /></>);
    expect(screen.getByRole("region", { name: "Things" })).toHaveAttribute("aria-roledescription", "carousel");
    expect(screen.getAllByRole("group")).toHaveLength(5);
    expect(screen.getByRole("group", { name: "2 of 5" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Show Title/ })).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("scrolls to the next slide from the button and from the arrow key, and never moves by itself", async () => {
    withLayout();
    const user = userEvent.setup();
    const scrollTo = vi.fn();
    HTMLElement.prototype.scrollTo = scrollTo as never;
    const { container } = render(<><h2 id="h">Things</h2><InputCarousel labelledBy="h" items={items} /></>);
    expect(scrollTo).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(container.querySelector(".carousel-track")!, { key: "ArrowRight" });
    expect(scrollTo).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Show Title c" }));
    expect(scrollTo).toHaveBeenCalledTimes(3);
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
