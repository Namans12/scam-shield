import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchCheck = vi.hoisted(() => vi.fn());
vi.mock("@/data", () => ({ fetchCheck }));
import ComplaintPage, { formatAmount } from "./ComplaintPage";
import { setLang } from "@/i18n";
import { makeResult } from "@/test/fixtures";

function renderPage(withState = true) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/complaint/chk_123", state: withState ? { result: makeResult() } : null }]}>
      <Routes>
        <Route path="/complaint/:id" element={<ComplaintPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setLang("en");
  fetchCheck.mockReset();
  fetchCheck.mockResolvedValue(null);
});

describe("formatAmount", () => {
  it("formats plain numbers and keeps free text", () => {
    expect(formatAmount("")).toBeUndefined();
    expect(formatAmount("50000")).toBe("Rs 50,000");
    expect(formatAmount("1,25,000.50")).toBe("Rs 125,000.50".replace("125,000", "1,25,000"));
    expect(formatAmount("about 5k")).toBe("about 5k");
  });
});

describe("ComplaintPage", () => {
  it("builds the draft from the check and the amount typed", async () => {
    const user = userEvent.setup();
    renderPage();
    const draft = screen.getByRole("textbox", { name: "Your complaint draft" }) as HTMLTextAreaElement;
    expect(draft.value).toContain("9876543210");
    expect(draft.value).not.toContain("Amount lost");
    await user.type(screen.getByLabelText(/Amount lost/), "50000");
    expect(draft.value).toContain("Amount lost: Rs 50,000");
  });

  it("links to cybercrime.gov.in and the 1930 helpline", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Open cybercrime.gov.in" })).toHaveAttribute("href", "https://cybercrime.gov.in");
    expect(screen.getByRole("link", { name: "Call 1930" })).toHaveAttribute("href", "tel:1930");
  });

  it("copies the draft", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    renderPage();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await user.click(screen.getByRole("button", { name: "Copy text" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Complaint regarding suspected online fraud"));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("asks to run the check again when the result is not on this device", async () => {
    renderPage(false);
    expect(await screen.findByText("This result is no longer on this device")).toBeInTheDocument();
  });
});
