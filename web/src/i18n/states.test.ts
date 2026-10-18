import { describe, expect, it } from "vitest";
import { INDIAN_STATES } from "@scam-shield/shared/states";
import { STATE_NAMES_HI, stateLabel } from "./states";

describe("state names", () => {
  it("has a Hindi name for every state and union territory, and no extras", () => {
    expect(Object.keys(STATE_NAMES_HI).sort()).toEqual([...INDIAN_STATES].sort());
    for (const v of Object.values(STATE_NAMES_HI)) expect(v).toMatch(/[ऀ-ॿ]/);
  });
  it("shows Hindi in Hindi, English otherwise, and unknown names unchanged", () => {
    expect(stateLabel("hi", "Maharashtra")).toBe("महाराष्ट्र");
    expect(stateLabel("hi", "Delhi")).toBe("दिल्ली");
    expect(stateLabel("en", "Maharashtra")).toBe("Maharashtra");
    expect(stateLabel("hi", "Atlantis")).toBe("Atlantis");
  });
});
