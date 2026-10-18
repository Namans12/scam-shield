import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CheckResult } from "@scam-shield/shared";
import { HowDecided } from "./HowDecided";
import { setLang } from "@/i18n";
import { makeResult } from "@/test/fixtures";

beforeEach(() => setLang("en"));

const bare = (o: Partial<CheckResult> = {}) =>
  makeResult({ red_flags: [], hits: [], entityKeys: [], hardSignals: [], verdict: "suspicious", ...o });

function open() {
  return screen.getByText("How this verdict was reached").closest("details")!;
}
const lines = (el: HTMLElement) => within(el).getAllByRole("listitem").map((li) => li.textContent);

describe("HowDecided", () => {
  it("is collapsed by default, in a details element a keyboard can open", () => {
    render(<HowDecided result={makeResult()} />);
    const details = open();
    expect(details).not.toHaveAttribute("open");
    expect(details.querySelector("summary")).toHaveTextContent("How this verdict was reached");
  });

  it("states what was read, what shaped the verdict and what could make it wrong, for a scam-list hit", () => {
    render(<HowDecided result={makeResult()} />);
    const details = open();
    expect(within(details).getByRole("heading", { name: "What was read" })).toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "What raised or shaped the verdict" })).toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "What could make this wrong" })).toBeInTheDocument();

    const all = lines(details);
    expect(all).toContain("The message text you pasted.");
    expect(all).toContain("Phone numbers, UPI IDs and websites found: 2. Each was looked up on the shared scam list.");
    expect(all).toContain("Warning signs the AI listed: 2.");
    expect(all).toContain("Scam list: something in this content is on the list. Reported 7 times, the most for any one item. A report is not proof. This raised the verdict.");
    expect(all).toContain("Rule checks (the scam list and the QR check) can only raise a verdict. They never lower it.");
    expect(all).toContain("This is guidance only. It is not a ruling and not proof.");
    expect(all).toContain("A brand-new scam may look completely normal.");
    expect(all).toContain("The AI can make mistakes and may read a message wrongly.");
  });

  it("never says confirmed, safe or anything with an emoji", () => {
    const { container } = render(<HowDecided result={makeResult({ qr: { raw: "upi://pay?pa=a@b", upi: { pa: "a@b" } }, hardSignals: ["qr_pay_disguised_as_receive", "multi_reported_entity"], linkScan: { requestedUrl: "http://x.example", redirects: ["a", "b"] } })} />);
    expect(container.textContent).not.toMatch(/confirmed|\bsafe\b/i);
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("says 'Reported 1 time' for a single report", () => {
    render(<HowDecided result={bare({ hardSignals: ["reported_entity"], hits: [{ key: "upi:a@b", reportCount: 1, scamTypes: [], linked: [], lastSeen: "2026-10-15T08:00:00.000Z" }] })} />);
    expect(lines(open()).join("\n")).toContain("Reported 1 time, the most");
  });

  it("explains a QR pay-versus-receive mismatch", () => {
    render(<HowDecided result={bare({ verdict: "scam", inputKind: "image", qr: { raw: "upi://pay?pa=a@b", upi: { pa: "a@b" } }, hardSignals: ["qr_pay_disguised_as_receive"] })} />);
    const all = lines(open());
    expect(all).toContain("Your screenshot or photo, including any text in the picture.");
    expect(all).toContain("A QR code found in your image.");
    expect(all).toContain("QR code: it asks you to PAY, but the message talks about receiving money. This raised the verdict to Scam.");
  });

  it("describes a link scan that opened, with its redirects", () => {
    render(<HowDecided result={bare({ inputKind: "link", linkScan: { requestedUrl: "http://x.example", finalUrl: "http://y.example", redirects: ["http://z.example", "http://y.example"] } })} />);
    const all = lines(open());
    expect(all).toContain("The link you sent.");
    expect(all).toContain("The page the link leads to, opened in an isolated browser, not on your phone.");
    expect(all).toContain("Link scan: the page the link leads to was shown to the AI together with your message.");
    expect(all).toContain("Link scan: the link went through 2 redirects before its final page.");
    expect(all).toContain("The page may behave differently for you than it did in our isolated browser.");
  });

  it("describes a link that could not be opened, without the page-behaviour limit", () => {
    render(<HowDecided result={bare({ linkScan: { requestedUrl: "http://x.example", redirects: [], blockedReason: "timeout" } })} />);
    const all = lines(open());
    expect(all).toContain("We tried to open the link but couldn't, so the page itself was not looked at.");
    expect(all).toContain("Link scan: the link could not be opened, so the AI judged without seeing the page.");
    expect(all).not.toContain("The page may behave differently for you than it did in our isolated browser.");
  });

  it("describes audio with and without a transcript", () => {
    const { unmount } = render(<HowDecided result={bare({ inputKind: "audio", transcript: "hello" })} />);
    expect(lines(open())).toContain("Your voice note, turned into text first.");
    unmount();
    render(<HowDecided result={bare({ inputKind: "audio" })} />);
    expect(lines(open())).toContain("Your voice note.");
  });

  it("leaves out every line whose data is missing", () => {
    render(<HowDecided result={bare()} />);
    const all = lines(open());
    const joined = all.join("\n");
    expect(joined).not.toMatch(/Scam list:|QR code|Link scan|redirects|Warning signs the AI listed|looked up on the shared scam list|behave differently|not being on the scam list/i);
    expect(joined).not.toMatch(/Not being on the scam list/);
    // What is left: what was read, the AI reading, the rule, and the limits that always apply.
    expect(all).toEqual([
      "The message text you pasted.",
      "The AI's reading of the content gave the score, the type of scam and the warning signs.",
      "Rule checks (the scam list and the QR check) can only raise a verdict. They never lower it.",
      "This is guidance only. It is not a ruling and not proof.",
      "A brand-new scam may look completely normal.",
      "The AI can make mistakes and may read a message wrongly.",
    ]);
  });

  it("copes with a stored result that lacks the newer fields", () => {
    const old = { ...bare() } as Partial<CheckResult>;
    delete old.hardSignals;
    delete old.hits;
    delete old.entityKeys;
    expect(() => render(<HowDecided result={old as CheckResult} />)).not.toThrow();
  });

  it("is available in Hindi, with the same structure", () => {
    setLang("hi");
    render(<HowDecided result={makeResult()} />);
    const details = screen.getByText("यह नतीजा कैसे निकला").closest("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByRole("heading", { name: "क्या पढ़ा गया" })).toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "नतीजे को किसने बढ़ाया या ढाला" })).toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "यह कहाँ ग़लत हो सकता है" })).toBeInTheDocument();
    expect(lines(details).join("\n")).toContain("7 बार रिपोर्ट");
    expect(lines(details).join("\n")).toContain("कभी नीचे नहीं करतीं");
    expect(lines(details).join("\n")).not.toMatch(/confirmed|पुष्टि/);
    act(() => setLang("en"));
  });
});
