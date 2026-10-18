import { describe, expect, it } from "vitest";
import { countWords, hasEnoughToJudge, MIN_WORDS, textHasLink } from "./judgeable";

describe("hasEnoughToJudge", () => {
  it("is false for the QA garbage, empty input and punctuation", () => {
    expect(hasEnoughToJudge({ text: "asdkjh qwe 123 !!! ???" })).toBe(false);
    expect(hasEnoughToJudge({ text: "" })).toBe(false);
    expect(hasEnoughToJudge({ text: "   \n " })).toBe(false);
    expect(hasEnoughToJudge({ text: "!!! ??? ... ,,," })).toBe(false);
    expect(hasEnoughToJudge({})).toBe(false);
  });

  it("is true once there are enough real words", () => {
    const justUnder = Array.from({ length: MIN_WORDS - 1 }, () => "word").join(" ");
    expect(hasEnoughToJudge({ text: justUnder })).toBe(false);
    expect(hasEnoughToJudge({ text: `${justUnder} word` })).toBe(true);
    expect(hasEnoughToJudge({ text: "Dear customer your bank account will be blocked today unless you update your KYC details now" })).toBe(true);
  });

  it("counts Hindi words, and ignores one-character scraps", () => {
    expect(countWords("आपका बैंक खाता आज बंद हो जाएगा")).toBe(7);
    expect(countWords("a b c 1 2 3")).toBe(0);
    expect(hasEnoughToJudge({ text: "आपका बैंक खाता आज बंद हो जाएगा तुरंत अपना केवाईसी अपडेट करें वरना खाता बंद" })).toBe(true);
  });

  it("accepts a short message that holds a link, phone number or UPI ID", () => {
    expect(hasEnoughToJudge({ text: "Click https://bit.ly/x1" })).toBe(true);
    expect(hasEnoughToJudge({ text: "pay at www.win-prize.xyz" })).toBe(true);
    expect(hasEnoughToJudge({ text: "bit.ly/abc" })).toBe(true);
    expect(hasEnoughToJudge({ text: "call 98765 43210" })).toBe(true);
    expect(hasEnoughToJudge({ text: "+91-98765-43210" })).toBe(true);
    expect(hasEnoughToJudge({ text: "send to ravi.kumar@okbnb" })).toBe(true);
  });

  it("does not mistake sloppy punctuation or short numbers for a link or phone number", () => {
    expect(hasEnoughToJudge({ text: "Hello.Please help" })).toBe(false);
    expect(hasEnoughToJudge({ text: "asdkjh.qwe" })).toBe(false);
    expect(hasEnoughToJudge({ text: "123 456 789" })).toBe(false);
  });

  it("accepts any attachment, and a real link in the link box but not a stray word", () => {
    expect(hasEnoughToJudge({ text: "asd", hasFile: true })).toBe(true);
    expect(hasEnoughToJudge({ hasFile: true })).toBe(true);
    expect(hasEnoughToJudge({ url: "https://example.test/x" })).toBe(true);
    expect(hasEnoughToJudge({ url: "bit.ly/abc" })).toBe(true);
    expect(hasEnoughToJudge({ url: "asd" })).toBe(false);
    expect(hasEnoughToJudge({ text: "asd qwe", url: "  " })).toBe(false);
  });
});

describe("textHasLink", () => {
  it("finds a link anywhere in the text", () => {
    expect(textHasLink("see http://bnb-kyc.example/login now")).toBe(true);
    expect(textHasLink("no link here, just words.")).toBe(false);
  });
});
