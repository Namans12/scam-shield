import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerdictBanner } from "./VerdictBanner";

describe("VerdictBanner", () => {
  it("labels no_signs without ever saying safe", () => {
    render(<VerdictBanner verdict="no_signs" lang="en" />);
    expect(screen.getByText("No scam signs found")).toBeInTheDocument();
    expect(screen.queryByText(/safe/i)).toBeNull();
  });

  it("shows the scam verdict in Hindi", () => {
    render(<VerdictBanner verdict="scam" lang="hi" />);
    expect(screen.getByText("धोखाधड़ी")).toBeInTheDocument();
  });

  it("shows the suspicious verdict", () => {
    render(<VerdictBanner verdict="suspicious" lang="en" />);
    expect(screen.getByText("Suspicious")).toBeInTheDocument();
  });
});
