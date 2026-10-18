import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckResult } from "@scam-shield/shared";
import ResultPage from "./ResultPage";

const fetchCheck = vi.hoisted(() => vi.fn());
vi.mock("@/data", () => ({ fetchCheck }));
import { setLang } from "@/i18n";
import { JPEG_DATA_URL, makeResult } from "@/test/fixtures";

function renderResult(result: CheckResult | undefined, id = "chk_123", extraState: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/result/${id}`, state: result ? { result, ...extraState } : undefined }]}>
      <Routes>
        <Route path="/result/:id" element={<ResultPage />} />
        <Route path="/" element={<p>check page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchCheck.mockReset();
  fetchCheck.mockResolvedValue(null);
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

    expect(screen.getByRole("button", { name: "Report this scam" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Draft a complaint" })).toHaveAttribute("href", "/complaint/chk_123");
    expect(screen.getByRole("button", { name: "Share a warning" })).toBeEnabled();
  });

  it("moves focus to the verdict heading so it is announced", () => {
    renderResult(makeResult());
    expect(screen.getByRole("heading", { level: 1, name: "Scam" })).toHaveFocus();
  });

  it("marks model-written text with the language of the result", () => {
    renderResult(makeResult({ language: "hi", summary: "सारांश", next_steps: ["कदम एक"] }));
    expect(screen.getByText("सारांश")).toHaveAttribute("lang", "hi");
    expect(screen.getByText("कदम एक").closest("li")).toHaveAttribute("lang", "hi");
    expect(screen.getByText("Urgent threat to block your account")).toHaveAttribute("lang", "hi");
    expect(screen.getByText("Your account will be blocked today").closest("blockquote")).toHaveAttribute("lang", "hi");
  });

  it("offers no report, complaint or share actions when no scam signs were found", () => {
    renderResult(makeResult({ verdict: "no_signs", risk_score: 6, scam_type: "none", red_flags: [], hits: [], hardSignals: [] }));
    expect(screen.queryByRole("button", { name: "Report this scam" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Draft a complaint" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Share a warning" })).toBeNull();
  });

  it("hides the report button when there is nothing to add to the list", () => {
    renderResult(makeResult({ entityKeys: [] }));
    expect(screen.queryByRole("button", { name: "Report this scam" })).toBeNull();
    expect(screen.getByRole("link", { name: "Draft a complaint" })).toBeInTheDocument();
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

  it("reads the result from Firestore when it is not in router state", async () => {
    fetchCheck.mockResolvedValue(makeResult({ id: "from-db", summary: "Loaded from the database." }));
    renderResult(undefined, "from-db");
    expect(screen.getByRole("status")).toHaveTextContent("Loading your result…");
    expect(await screen.findByText("Loaded from the database.")).toBeInTheDocument();
    expect(fetchCheck).toHaveBeenCalledWith("from-db");
  });

  it("shows a friendly page when the result is not in router state or Firestore", async () => {
    renderResult(undefined);
    expect(await screen.findByText("This result is no longer on this device")).toBeInTheDocument();
    const again = screen.getByRole("link", { name: "Check again" });
    expect(again).toHaveAttribute("href", "/check");
  });

  it("does not show a result for a different id", async () => {
    renderResult(makeResult({ id: "other" }), "chk_123");
    expect(await screen.findByText("This result is no longer on this device")).toBeInTheDocument();
  });

  it("is available in Hindi", () => {
    renderResult(makeResult());
    act(() => setLang("hi"));
    expect(screen.getAllByText("धोखाधड़ी").length).toBeGreaterThan(0);
    expect(screen.getByText("चेतावनी के संकेत")).toBeInTheDocument();
    expect(screen.getByText("7 बार रिपोर्ट किया गया")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1930" })).toHaveAttribute("href", "tel:1930");
  });

  describe("QR card", () => {
    it("shows a UPI QR as a request to PAY, with the payee as plain text", () => {
      const { container } = renderResult(
        makeResult({
          inputKind: "image",
          qr: { raw: "upi://pay?pa=ravi.kumar@okbnb&pn=Ravi&am=4999&tn=refund", upi: { pa: "ravi.kumar@okbnb", pn: "Ravi", am: "4999", tn: "refund" } },
        }),
      );
      expect(screen.getByText("This QR asks you to PAY")).toBeInTheDocument();
      const vpa = screen.getByTestId("qr-payee");
      expect(vpa).toHaveTextContent("ravi.kumar@okbnb");
      expect(vpa.closest("a")).toBeNull();
      expect(container.querySelector("a[href^='upi:']")).toBeNull();
      expect(screen.getByText("Ravi")).toBeInTheDocument();
      expect(screen.getByText("₹4999")).toBeInTheDocument();
      expect(screen.getByText("refund")).toBeInTheDocument();
      expect(screen.getByText(/You never need to scan a QR code to receive money/)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /ravi/ })).toBeNull();
    });

    it("does not print a double rupee sign", () => {
      renderResult(makeResult({ qr: { raw: "x", upi: { pa: "a@b", am: "₹5,000.00" } } }));
      expect(screen.getByText("₹5,000.00")).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("₹₹");
    });

    it.each([
      ["Rs. 500", "₹500"],
      ["INR 1,200.50", "₹1,200.50"],
      ["rs500", "₹500"],
      ["  ₹ 75 ", "₹75"],
      ["250", "₹250"],
    ])("normalises the amount %j to %j", (am, shown) => {
      renderResult(makeResult({ qr: { raw: "x", upi: { pa: "a@b", am } } }));
      expect(screen.getByText(shown)).toBeInTheDocument();
    });

    it("shows an amount that is not a plain number verbatim, with no rupee prefix", () => {
      renderResult(makeResult({ qr: { raw: "x", upi: { pa: "a@b", am: "five thousand" } } }));
      expect(screen.getByText("five thousand")).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("₹five");
    });

    it("renders a script-like payee name and note as text", () => {
      const evil = "<script>window.__pwned = true</script>";
      const { container } = renderResult(
        makeResult({ qr: { raw: "x", upi: { pa: "a@b", pn: evil, tn: "<img src=x onerror=alert(1)>" } } }),
      );
      expect(screen.getByText(evil)).toBeInTheDocument();
      expect(container.querySelector("script")).toBeNull();
      expect(container.querySelector("img")).toBeNull();
      expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    });

    it("leaves out the fields a UPI QR does not have", () => {
      renderResult(makeResult({ qr: { raw: "x", upi: { pa: "a@b" } } }));
      expect(screen.queryByText("Amount")).toBeNull();
      expect(screen.queryByText("Note")).toBeNull();
      expect(screen.queryByText("Payee name")).toBeNull();
    });

    it("shows other QR content as plain text, cut at 300 characters", () => {
      const raw = "https://evil.example/" + "a".repeat(400);
      const { container } = renderResult(makeResult({ qr: { raw } }));
      expect(screen.getByText("This QR contains:")).toBeInTheDocument();
      const shown = screen.getByTestId("qr-raw");
      expect(shown.textContent!.length).toBeLessThanOrEqual(301);
      expect(shown.textContent).toContain("https://evil.example/");
      expect(shown.textContent!.endsWith("…")).toBe(true);
      expect(screen.getByTestId("qr-shortened")).toHaveTextContent("(shortened)");
      expect(shown.closest("a")).toBeNull();
      expect(container.querySelector("a[href*='evil']")).toBeNull();
      expect(screen.queryByText("This QR asks you to PAY")).toBeNull();
    });

    it("shows a short non-UPI QR in full without an ellipsis", () => {
      renderResult(makeResult({ qr: { raw: "WIFI:S:cafe;T:WPA;P:pw;;" } }));
      expect(screen.getByTestId("qr-raw")).toHaveTextContent("WIFI:S:cafe;T:WPA;P:pw;;");
      expect(screen.queryByTestId("qr-shortened")).toBeNull();
    });

    it("shows no QR card when there is no QR", () => {
      renderResult(makeResult());
      expect(screen.queryByText("QR code")).toBeNull();
    });
  });

  describe("voice note transcript", () => {
    it("shows what was said in a collapsible block, as text in the result language", () => {
      const evil = "<b>pay now</b> aapka account band ho jayega";
      const { container } = renderResult(makeResult({ inputKind: "audio", transcript: evil, language: "hi" }));
      const summary = screen.getByText("What was said");
      expect(summary.closest("details")).not.toBeNull();
      expect(summary.closest("details")).not.toHaveAttribute("open");
      const body = screen.getByText(evil);
      expect(body).toHaveAttribute("lang", "hi");
      expect(container.querySelector("b")).toBeNull();
    });

    it("does not show the block for a text check", () => {
      renderResult(makeResult({ inputKind: "text", transcript: "ignored" }));
      expect(screen.queryByText("What was said")).toBeNull();
    });

    it("does not show an empty block for audio without a transcript", () => {
      renderResult(makeResult({ inputKind: "audio" }));
      expect(screen.queryByText("What was said")).toBeNull();
    });
  });

  describe("input too thin to judge", () => {
    const noSigns = () => makeResult({ verdict: "no_signs", risk_score: 0, scam_type: "none", summary: "Nothing in this text.", red_flags: [], hits: [], entityKeys: [], hardSignals: [] });

    it("replaces the no-signs banner with 'Not enough to judge', and shows no score, buttons or reassurance", () => {
      renderResult(noSigns(), "chk_123", { unclear: true });
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Not enough to judge");
      expect(screen.getByText(/Paste the full message, link or screenshot and check again/)).toBeInTheDocument();
      expect(screen.queryByText("No scam signs found")).toBeNull();
      expect(screen.queryByRole("meter")).toBeNull();
      expect(screen.queryByText("Warning signs")).toBeNull();
      expect(screen.queryByText("No specific warning signs were listed.")).toBeNull();
      expect(screen.queryByRole("button", { name: "Report this scam" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Draft a complaint" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Share a warning" })).toBeNull();
      expect(screen.queryByText("How this verdict was reached")).toBeNull();
      expect(screen.getByRole("link", { name: /Check another message/ })).toBeInTheDocument();
    });

    it("moves focus to the new heading", () => {
      renderResult(noSigns(), "chk_123", { unclear: true });
      expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    });

    it("is available in Hindi", () => {
      setLang("hi");
      renderResult(noSigns(), "chk_123", { unclear: true });
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("परखने के लिए काफ़ी नहीं");
      expect(screen.queryByText("धोखाधड़ी के संकेत नहीं मिले")).toBeNull();
    });

    it("keeps the normal no-signs result when the input was enough", () => {
      renderResult(noSigns(), "chk_123", { unclear: false });
      expect(screen.getByText("No scam signs found")).toBeInTheDocument();
      expect(screen.queryByText("Not enough to judge")).toBeNull();
    });

    it("never softens a Scam or Suspicious result, whatever the flag says", () => {
      renderResult(makeResult(), "chk_123", { unclear: true });
      expect(screen.getByText("Scam")).toBeInTheDocument();
      expect(screen.queryByText("Not enough to judge")).toBeNull();
      expect(screen.getByRole("button", { name: "Report this scam" })).toBeEnabled();
    });
  });

  it("shows the collapsed 'How this verdict was reached' panel on a result", () => {
    renderResult(makeResult());
    const summary = screen.getByText("How this verdict was reached");
    expect(summary.closest("details")).not.toHaveAttribute("open");
  });
});
