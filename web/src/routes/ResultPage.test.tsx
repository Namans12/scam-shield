import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import type { CheckResult } from "@scam-shield/shared";
import ResultPage from "./ResultPage";
import { setLang } from "@/i18n";
import { JPEG_DATA_URL, makeResult } from "@/test/fixtures";

function renderResult(result: CheckResult | undefined, id = "chk_123") {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/result/${id}`, state: result ? { result } : undefined }]}>
      <Routes>
        <Route path="/result/:id" element={<ResultPage />} />
        <Route path="/" element={<p>check page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // The UI language is module-level state: reset it so tests do not leak into each other.
  setLang("en");
});

describe("ResultPage", () => {
  it("renders verdict, flags, scam-list hits and the disclaimer", () => {
    renderResult(makeResult());

    expect(screen.getByText("Scam")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Risk score" })).toHaveAttribute("aria-valuenow", "92");
    expect(screen.getAllByText("Fake KYC update").length).toBeGreaterThan(0);
    expect(screen.getByText(/pretends to be your bank/)).toBeInTheDocument();

    expect(screen.getByText("Urgent threat to block your account")).toBeInTheDocument();
    expect(screen.getByText("Your account will be blocked today").closest("blockquote")).not.toBeNull();
    expect(screen.getByText("Do not tap the link.")).toBeInTheDocument();

    // Scam-list wording and masking: never the raw number or UPI id.
    expect(screen.getByText("Reported 7 times")).toBeInTheDocument();
    expect(screen.getByText("+91 98XXXXX210")).toBeInTheDocument();
    expect(screen.getByText("ra******ar@okbnb")).toBeInTheDocument();
    expect(screen.queryByText(/9876543210/)).toBeNull();
    expect(screen.queryByText(/ravi\.kumar/)).toBeNull();

    const call = screen.getByRole("link", { name: "1930" });
    expect(call).toHaveAttribute("href", "tel:1930");
    expect(call.closest("p")).toHaveTextContent("Guidance only. If you've lost money, call 1930 immediately.");

    // Report / complaint / share are disabled placeholders until a later task.
    for (const name of ["Report this scam", "Draft a complaint", "Share a warning"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("never uses the word safe, even for no_signs", () => {
    renderResult(makeResult({ verdict: "no_signs", risk_score: 6, scam_type: "none", red_flags: [], hits: [], hardSignals: [] }));
    expect(screen.getByText("No scam signs found")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bsafe\b/i);
    expect(screen.getByText("No specific warning signs were listed.")).toBeInTheDocument();
  });

  it("renders evidence containing markup as plain text", () => {
    const evil = '<script>window.__pwned = true</script><img src=x onerror="window.__pwned = true">';
    const { container } = renderResult(
      makeResult({ red_flags: [{ flag: "Odd text", evidence: evil, why_it_matters: "<b>bold?</b>" }] }),
    );
    expect(screen.getByText(evil)).toBeInTheDocument();
    expect(screen.getByText("<b>bold?</b>")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it("shows the link scan with the final URL as text, not a link", () => {
    renderResult(
      makeResult({
        linkScan: {
          requestedUrl: "http://short.example/a",
          finalUrl: "http://bnb-kyc-update.example/login",
          redirects: ["http://short.example/a", "http://hop.example/b"],
          title: "Bharat National Bank login",
          screenshotDataUrl: JPEG_DATA_URL,
        },
      }),
    );
    const finalUrl = screen.getByTestId("final-url");
    expect(finalUrl).toHaveTextContent("http://bnb-kyc-update.example/login");
    expect(finalUrl.closest("a")).toBeNull();
    expect(screen.queryByRole("link", { name: /bnb-kyc-update/ })).toBeNull();
    expect(screen.getByText("Sent through 2 redirects")).toBeInTheDocument();
    const img = screen.getByRole("img", { name: "Screenshot of the page the link leads to" });
    expect(img).toHaveAttribute("src", JPEG_DATA_URL);
  });

  it.each([
    ["a PNG data URL", "data:image/png;base64,iVBORw0KGgo="],
    ["an SVG data URL", "data:image/svg+xml;base64,PHN2Zy8+"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a remote URL", "https://evil.example/shot.jpg"],
    ["a JPEG data URL with junk after it", 'data:image/jpeg;base64,AAAA" onerror="alert(1)'],
  ])("does not render a screenshot that is %s", (_name, src) => {
    renderResult(
      makeResult({ linkScan: { requestedUrl: "http://x.example", finalUrl: "http://x.example", redirects: [], screenshotDataUrl: src } }),
    );
    expect(screen.getByText("No redirects")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Screenshot/ })).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("explains a blocked link scan", () => {
    renderResult(makeResult({ linkScan: { requestedUrl: "http://10.0.0.1", redirects: [], blockedReason: "private_address" } }));
    expect(screen.getByText(/couldn't open this link/)).toBeInTheDocument();
  });

  it("shows a friendly page when the result is not in router state", () => {
    renderResult(undefined);
    expect(screen.getByText("This result is no longer on this device")).toBeInTheDocument();
    const again = screen.getByRole("link", { name: "Check again" });
    expect(again).toHaveAttribute("href", "/");
  });

  it("does not show a result for a different id", () => {
    renderResult(makeResult({ id: "other" }), "chk_123");
    expect(screen.getByText("This result is no longer on this device")).toBeInTheDocument();
  });

  it("is available in Hindi", () => {
    renderResult(makeResult());
    act(() => setLang("hi"));
    expect(screen.getAllByText("धोखाधड़ी").length).toBeGreaterThan(0);
    expect(screen.getByText("चेतावनी के संकेत")).toBeInTheDocument();
    expect(screen.getByText("7 बार रिपोर्ट किया गया")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1930" })).toHaveAttribute("href", "tel:1930");
  });
});
