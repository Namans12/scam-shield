import { describe, expect, it } from "vitest";
import { INDIAN_STATES } from "./states";

describe("INDIAN_STATES", () => {
  it("lists the 28 states and 8 union territories once each", () => {
    expect(INDIAN_STATES).toHaveLength(36);
    expect(new Set(INDIAN_STATES).size).toBe(36);
    expect(INDIAN_STATES).toContain("Maharashtra");
    expect(INDIAN_STATES).toContain("Delhi");
  });
});
