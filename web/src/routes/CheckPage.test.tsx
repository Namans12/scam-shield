import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CheckPage from "./CheckPage";
import { setLang } from "@/i18n";
import { makeResult } from "@/test/fixtures";

const checkContent = vi.hoisted(() => vi.fn());

vi.mock("@/api", async () => {
  const actual = await vi.importActual<typeof import("@/api")>("@/api");
  return { ...actual, checkContent };
});

// Imported after the mock so ApiError is the real class.
import { ApiError } from "@/api";

function ResultProbe() {
  const loc = useLocation();
  const state = loc.state as { result?: { id: string } } | null;
  return <p>result page {loc.pathname} {state?.result?.id}</p>;
}

function renderCheck() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<CheckPage />} />
        <Route path="/result/:id" element={<ResultProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  checkContent.mockReset();
  setLang("en");
});

describe("CheckPage", () => {
  it("disables Check until there is a message or a link", async () => {
    const user = userEvent.setup();
    renderCheck();
    const button = screen.getByRole("button", { name: "Check" });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("The message"), "   ");
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("The message"), "Your KYC is expiring");
    expect(button).toBeEnabled();
  });

  it("enables Check when only a link is given", async () => {
    const user = userEvent.setup();
    renderCheck();
    await user.type(screen.getByLabelText(/A link you were sent/), "https://example.test/x");
    expect(screen.getByRole("button", { name: "Check" })).toBeEnabled();
  });

  it("sends the trimmed text and chosen language, then opens the result", async () => {
    const user = userEvent.setup();
    checkContent.mockResolvedValue(makeResult({ id: "abc" }));
    renderCheck();
    await user.type(screen.getByLabelText("The message"), "  pay now  ");
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(checkContent).toHaveBeenCalledWith({ text: "pay now", url: undefined, lang: "en" });
    await waitFor(() => expect(screen.getByText(/result page \/result\/abc abc/)).toBeInTheDocument());
  });

  it("shows progress while checking without losing keyboard focus", async () => {
    const user = userEvent.setup();
    checkContent.mockReturnValue(new Promise(() => {}));
    renderCheck();
    // The live region exists before anything happens so screen readers announce changes to it.
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();

    await user.type(screen.getByLabelText("The message"), "hello");
    const button = screen.getByRole("button", { name: "Check" });
    await user.click(button);

    expect(screen.getByRole("status")).toHaveTextContent("Checking… usually 5–15 seconds");
    // Busy, not disabled: a disabled button would drop keyboard focus.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    await user.click(button);
    expect(checkContent).toHaveBeenCalledTimes(1);
  });

  it("says it is taking longer after 20 seconds", async () => {
    vi.useFakeTimers();
    try {
      checkContent.mockReturnValue(new Promise(() => {}));
      renderCheck();
      fireEvent.change(screen.getByLabelText("The message"), { target: { value: "hello" } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
      expect(screen.getByRole("status")).toHaveTextContent("Checking…");

      act(() => {
        vi.advanceTimersByTime(19_000);
      });
      expect(screen.getByRole("status")).toHaveTextContent("Checking…");
      act(() => {
        vi.advanceTimersByTime(2_000);
      });
      expect(screen.getByRole("status")).toHaveTextContent("taking longer than usual");
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells the person when the 5,000 character limit is reached", () => {
    renderCheck();
    expect(screen.queryByText("Only the first 5,000 characters are checked.")).toBeNull();
    fireEvent.change(screen.getByLabelText("The message"), { target: { value: "a".repeat(5000) } });
    expect(screen.getByText("Only the first 5,000 characters are checked.")).toBeInTheDocument();
  });

  it("shows a friendly message for daily_limit", async () => {
    const user = userEvent.setup();
    checkContent.mockRejectedValue(new ApiError("daily_limit", 429));
    renderCheck();
    await user.type(screen.getByLabelText("The message"), "hello");
    await user.click(screen.getByRole("button", { name: "Check" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/reached today's limit/);
    expect(alert).not.toHaveTextContent("daily_limit");
    // The message stays so the person can try again later.
    expect(screen.getByLabelText("The message")).toHaveValue("hello");
    expect(screen.getByRole("button", { name: "Check" })).toBeEnabled();
  });

  it.each([
    ["rate_limited", /too fast/],
    ["analysis_failed", /couldn't analyse/],
    ["empty_input", /Paste a message or a link/],
    ["text_too_long", /too long/],
    ["bad_url", /valid link/],
    ["unsupported_type", /type of file/],
    ["file_too_large", /too large/],
    ["unauthorized", /reload the page/],
    ["network", /Can't reach the server/],
    ["something_new", /Something went wrong/],
  ])("maps %s to a friendly message", async (code, expected) => {
    const user = userEvent.setup();
    checkContent.mockRejectedValue(new ApiError(code, 400));
    renderCheck();
    await user.type(screen.getByLabelText("The message"), "hello");
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
  });

  it("treats a thrown network TypeError as a connection problem", async () => {
    const user = userEvent.setup();
    checkContent.mockRejectedValue(new TypeError("Failed to fetch"));
    renderCheck();
    await user.type(screen.getByLabelText("The message"), "hello");
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Can't reach the server/);
  });

  it("sends lang hi when Hindi is selected", async () => {
    const user = userEvent.setup();
    setLang("hi");
    checkContent.mockResolvedValue(makeResult({ id: "h1", language: "hi" }));
    renderCheck();
    await user.type(screen.getByLabelText("मैसेज"), "नमस्ते");
    await user.click(screen.getByRole("button", { name: "जाँचें" }));
    expect(checkContent).toHaveBeenCalledWith({ text: "नमस्ते", url: undefined, lang: "hi" });
  });
});
