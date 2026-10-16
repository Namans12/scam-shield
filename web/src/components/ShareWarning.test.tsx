import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareWarning } from "./ShareWarning";
import { setLang } from "@/i18n";
import { makeResult } from "@/test/fixtures";

const renderWarningCard = vi.hoisted(() => vi.fn());
vi.mock("@/share/renderCard", async () => {
  const actual = await vi.importActual<typeof import("@/share/renderCard")>("@/share/renderCard");
  return { ...actual, renderWarningCard };
});

beforeEach(() => {
  setLang("en");
  renderWarningCard.mockReset();
  renderWarningCard.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
});
afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
  vi.restoreAllMocks();
});

describe("ShareWarning", () => {
  it("shares the card picture and text when the browser can share files", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    render(<ShareWarning result={makeResult()} />);
    await user.click(screen.getByRole("button", { name: "Share a warning" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const data = share.mock.calls[0]![0];
    expect(data.files[0]).toMatchObject({ name: "scam-warning.png", type: "image/png" });
    expect(data.text).toContain("1930");
  });

  it("shares the text alone when files cannot be shared", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
    render(<ShareWarning result={makeResult()} />);
    await user.click(screen.getByRole("button", { name: "Share a warning" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0]![0].files).toBeUndefined();
  });

  it("opens WhatsApp with the text when the browser cannot share", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<ShareWarning result={makeResult()} />);
    await user.click(screen.getByRole("button", { name: "Share a warning" }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(String(open.mock.calls[0]![0])).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it("does not show an error when the share sheet is dismissed", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockRejectedValue(new DOMException("dismissed", "AbortError"));
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<ShareWarning result={makeResult()} />);
    await user.click(screen.getByRole("button", { name: "Share a warning" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
