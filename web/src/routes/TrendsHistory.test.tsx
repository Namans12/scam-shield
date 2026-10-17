import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrendsPage from "./TrendsPage";
import HistoryPage from "./HistoryPage";
import { setLang } from "@/i18n";
import { makeResult } from "@/test/fixtures";

const fetchTrends = vi.hoisted(() => vi.fn());
const fetchHistory = vi.hoisted(() => vi.fn());
vi.mock("@/data", async () => {
  const actual = await vi.importActual<typeof import("@/data")>("@/data");
  return { ...actual, fetchTrends, fetchHistory };
});

beforeEach(() => {
  setLang("en");
  fetchTrends.mockReset();
  fetchHistory.mockReset();
});

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("TrendsPage", () => {
  it("shows totals, scam types, states and recent masked identifiers", async () => {
    fetchTrends.mockResolvedValue({
      days: [{ day: "2026-10-16", total: 12, byType: { kyc_update: 7, digital_arrest: 5 }, byState: { Maharashtra: 6 } }],
      recent: [{ masked: "+91 70XXXXX111", type: "phone", scamType: "kyc_update", reportCount: 3, lastSeen: "2026-10-16T10:00:00Z" }],
    });
    wrap(<TrendsPage />);
    expect(await screen.findByText("12 reports in the last 7 days")).toBeInTheDocument();
    expect(screen.getByText("Fake KYC update", { selector: "span.font-medium" })).toBeInTheDocument();
    expect(screen.getByText("Maharashtra")).toBeInTheDocument();
    expect(screen.getByText("+91 70XXXXX111")).toBeInTheDocument();
    expect(screen.getByText("Reported 3 times")).toBeInTheDocument();
    expect(screen.getByText(/Includes demo data/)).toBeInTheDocument();
  });

  it("says so when there are no reports", async () => {
    fetchTrends.mockResolvedValue({ days: [], recent: [] });
    wrap(<TrendsPage />);
    expect(await screen.findByText("No reports yet.")).toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    fetchTrends.mockRejectedValueOnce(new Error("offline"));
    wrap(<TrendsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load the trends");
    fetchTrends.mockResolvedValue({ days: [], recent: [] });
    screen.getByRole("button", { name: "Try again" }).click();
    expect(await screen.findByText("No reports yet.")).toBeInTheDocument();
  });
});

describe("HistoryPage", () => {
  it("lists checks newest first, each linking to its result", async () => {
    fetchHistory.mockResolvedValue([makeResult({ id: "a", summary: "First one" }), makeResult({ id: "b", verdict: "no_signs", scam_type: "none", summary: "Second one" })]);
    wrap(<HistoryPage />);
    const first = await screen.findByRole("link", { name: /First one/ });
    expect(first).toHaveAttribute("href", "/result/a");
    expect(screen.getByRole("link", { name: /Second one/ })).toHaveAttribute("href", "/result/b");
    expect(screen.getByText("No scam signs found")).toBeInTheDocument();
  });

  it("shows an empty state with a way to start", async () => {
    fetchHistory.mockResolvedValue([]);
    wrap(<HistoryPage />);
    expect(await screen.findByText("You haven't checked anything yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check a message" })).toHaveAttribute("href", "/check");
  });
});
