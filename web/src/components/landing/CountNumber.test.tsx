import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { CountNumber, countText } from "./CountNumber";

// A controllable IntersectionObserver and requestAnimationFrame: the test decides when the number scrolls into view
// and how much time passes between frames.
let intersect: () => void;
let clock = 0;
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
let disconnects = 0;

function installStubs() {
  clock = 1000;
  frames = new Map();
  nextFrame = 1;
  disconnects = 0;
  class FakeObserver {
    cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) { this.cb = cb; intersect = () => act(() => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)); }
    observe() {}
    unobserve() {}
    takeRecords() { return []; }
    disconnect() { disconnects += 1; }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.set(nextFrame, cb); return nextFrame++; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
}

/** Advances the clock by `ms` and runs the frames that were queued. */
function advance(ms: number) {
  clock += ms;
  const due = [...frames.entries()];
  frames.clear();
  act(() => { for (const [, cb] of due) cb(clock); });
}

function reducedMotion() {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null }));
}

const decimalsOf = (s: string) => (s.includes(".") ? s.length - s.indexOf(".") - 1 : 0);

/** Runs a full animation and returns every distinct text it showed, in order (starting with the one before it begins). */
function record(container: HTMLElement, totalMs = 3000, step = 16): string[] {
  const text = () => container.querySelector(".count-number-text")!.textContent!;
  const seen = [text()];
  intersect();
  for (let t = 0; t <= totalMs; t += step) {
    advance(step);
    if (text() !== seen[seen.length - 1]) seen.push(text());
  }
  return seen;
}

beforeEach(installStubs);
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("countText", () => {
  it("keeps the decimals of the final value and ends on it exactly", () => {
    expect(countText("97.6", 0, 0)).toBe("0.0");
    expect(countText("97.6", 0, 0.5)).toMatch(/^\d+\.\d$/);
    expect(countText("97.6", 0, 1)).toBe("97.6");
    expect(countText("100", 0, 0.5)).toMatch(/^\d+$/);
    expect(countText("5.0", 90, 0)).toBe("90.0");
    expect(countText("5.0", 90, 1)).toBe("5.0");
  });
});

describe("CountNumber", () => {
  it("shows the start value before it scrolls into view, never the final one", () => {
    const { container } = render(<CountNumber value="97.6" />);
    expect(container.querySelector(".count-number-text")).toHaveTextContent("0.0");
    advance(5000);
    expect(container.querySelector(".count-number-text")).toHaveTextContent("0.0");
    expect(screen.queryByText("97.6")).toBeNull();
  });

  it("counts a down-counter from its start value, not its final one", () => {
    const { container } = render(<CountNumber value="5.0" from={90} />);
    expect(container.querySelector(".count-number-text")).toHaveTextContent("90.0");
  });

  it("counts up monotonically from 0 to 97.6, keeping one decimal at every step and ending exactly on it", () => {
    const { container } = render(<CountNumber value="97.6" />);
    const seen = record(container);
    expect(seen[0]).toBe("0.0");
    expect(seen.at(-1)).toBe("97.6");
    expect(seen.length).toBeGreaterThan(20);
    const nums = seen.map(Number);
    for (let i = 1; i < nums.length; i += 1) expect(nums[i]!).toBeGreaterThan(nums[i - 1]!);
    for (const text of seen) expect(text).toMatch(/^\d+\.\d$/);
    expect(seen.slice(0, -1)).not.toContain("97.6");
  });

  it("counts down monotonically from 90 to 5.0, keeping one decimal at every step", () => {
    const { container } = render(<CountNumber value="5.0" from={90} />);
    const seen = record(container);
    expect(seen[0]).toBe("90.0");
    expect(seen.at(-1)).toBe("5.0");
    const nums = seen.map(Number);
    for (let i = 1; i < nums.length; i += 1) expect(nums[i]!).toBeLessThan(nums[i - 1]!);
    for (const text of seen) expect(text).toMatch(/^\d+\.\d$/);
    // it visibly decreases: well above the final value for a good part of the run
    expect(nums.filter((n) => n > 20).length).toBeGreaterThan(5);
  });

  it("counts 90 down to 0 and ends on exactly '0'", () => {
    const { container } = render(<CountNumber value="0" from={90} />);
    const seen = record(container);
    expect(seen[0]).toBe("90");
    expect(seen.at(-1)).toBe("0");
    for (const text of seen) expect(text).toMatch(/^\d+$/);
    const nums = seen.map(Number);
    for (let i = 1; i < nums.length; i += 1) expect(nums[i]!).toBeLessThan(nums[i - 1]!);
  });

  it("counts whole numbers for an integer value like 100", () => {
    const { container } = render(<CountNumber value="100" />);
    const seen = record(container);
    expect(seen[0]).toBe("0");
    expect(seen.at(-1)).toBe("100");
    for (const text of seen) expect(text).toMatch(/^\d+$/);
  });

  it("takes about two seconds, with an ease-out curve (fast first, slow last)", () => {
    const { container } = render(<CountNumber value="100" />);
    const text = () => Number(container.querySelector(".count-number-text")!.textContent);
    intersect();
    advance(0);
    advance(1000);
    expect(text()).toBeGreaterThan(80);
    advance(500);
    expect(text()).toBeLessThan(100);
    advance(600);
    expect(text()).toBe(100);
  });

  it("waits for its delay before it starts counting", () => {
    const { container } = render(<CountNumber value="100" delay={250} />);
    const text = () => container.querySelector(".count-number-text")!.textContent;
    intersect();
    advance(0);
    advance(200);
    expect(text()).toBe("0");
    advance(100);
    expect(Number(text())).toBeGreaterThan(0);
  });

  it("starts only once it is in view, and only once", () => {
    const { container } = render(<CountNumber value="100" />);
    expect(frames.size).toBe(0);
    intersect();
    expect(frames.size).toBe(1);
    expect(disconnects).toBeGreaterThan(0);
    intersect(); // a second intersection (not possible in a browser once disconnected) must not start a second animation
    expect(frames.size).toBe(1);
    advance(0);
    advance(5000);
    expect(container.querySelector(".count-number-text")).toHaveTextContent("100");
    expect(frames.size).toBe(0);
  });

  it("shows the final value at once with reduced motion", () => {
    reducedMotion();
    const { container } = render(<CountNumber value="97.6" />);
    expect(container.querySelector(".count-number-text")).toHaveTextContent("97.6");
    expect(frames.size).toBe(0);
  });

  it("shows the final value at once where there is no IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<CountNumber value="5.0" from={90} />);
    expect(container.querySelector(".count-number-text")).toHaveTextContent("5.0");
  });

  it("gives assistive tech only the final value, and the final value is findable by text once done", () => {
    const { container } = render(<CountNumber value="97.6" />);
    expect(screen.getByRole("img", { name: "97.6" })).toBeInTheDocument();
    expect(container.querySelector("[aria-label]")).toHaveAttribute("aria-label", "97.6");
    record(container);
    expect(screen.getAllByText("97.6")).toHaveLength(1);
  });

  it("reserves the width of its widest text, so the layout does not jump", () => {
    const { container } = render(<CountNumber value="5.0" from={90} />);
    expect(container.querySelector(".count-number")).toHaveAttribute("data-sizer", "90.0");
    const other = render(<CountNumber value="100" />);
    expect(other.container.querySelector(".count-number")).toHaveAttribute("data-sizer", "100");
  });

  it("cancels the animation when it unmounts", () => {
    const { unmount } = render(<CountNumber value="100" />);
    intersect();
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });

  it("stops watching for scroll when it unmounts before coming into view", () => {
    const { unmount } = render(<CountNumber value="100" />);
    const before = disconnects;
    unmount();
    expect(disconnects).toBeGreaterThan(before);
  });

  it("restarts from its start value when the value changes", () => {
    const { container, rerender } = render(<CountNumber value="97.6" />);
    record(container);
    expect(container.querySelector(".count-number-text")).toHaveTextContent("97.6");
    rerender(<CountNumber value="42.5" />);
    expect(container.querySelector(".count-number-text")).toHaveTextContent("0.0");
    const seen = record(container);
    expect(seen.at(-1)).toBe("42.5");
    expect(seen).not.toContain("97.6");
  });

  it("is monotonic with the exact final string for 200 random targets, up and down", () => {
    // deterministic pseudo-random numbers so a failure is reproducible
    let seed = 12345;
    const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    for (let n = 0; n < 200; n += 1) {
      const decimals = Math.floor(rand() * 3);
      const down = n % 2 === 1;
      const target = down ? rand() * 80 : 5 + rand() * 95;
      const from = down ? 90 : 0;
      const value = target.toFixed(decimals);
      const { container, unmount } = render(<CountNumber value={value} from={from} />);
      const seen = record(container, 2600, 40);
      expect(seen.at(-1)).toBe(value);
      expect(seen[0]).toBe(from.toFixed(decimals));
      for (const text of seen) expect(decimalsOf(text)).toBe(decimals);
      const nums = seen.map(Number);
      for (let i = 1; i < nums.length; i += 1) down ? expect(nums[i]!).toBeLessThan(nums[i - 1]!) : expect(nums[i]!).toBeGreaterThan(nums[i - 1]!);
      unmount();
    }
  });
});
