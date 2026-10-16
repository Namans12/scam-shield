import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportDialog, reportErrorKey } from "./ReportDialog";
import { setLang } from "@/i18n";
import { makeResult } from "@/test/fixtures";

const reportCheck = vi.hoisted(() => vi.fn());
const ensureAnonymousUser = vi.hoisted(() => vi.fn());
const signInWithGoogle = vi.hoisted(() => vi.fn());

vi.mock("@/api", async () => {
  const actual = await vi.importActual<typeof import("@/api")>("@/api");
  return { ...actual, reportCheck };
});
vi.mock("@/firebase", async () => {
  const actual = await vi.importActual<typeof import("@/firebase")>("@/firebase");
  return { ...actual, ensureAnonymousUser, signInWithGoogle };
});
import { ApiError } from "@/api";

const anon = { uid: "u1", providerData: [] };
const google = { uid: "u1", providerData: [{ providerId: "google.com" }] };

beforeEach(() => {
  reportCheck.mockReset();
  ensureAnonymousUser.mockReset();
  signInWithGoogle.mockReset();
  setLang("en");
});

const open = () => render(<ReportDialog result={makeResult()} open onOpenChange={() => {}} />);

describe("ReportDialog", () => {
  it("asks an anonymous visitor to sign in with Google before anything else", async () => {
    ensureAnonymousUser.mockResolvedValue(anon);
    open();
    expect(await screen.findByRole("button", { name: "Sign in with Google" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Add to scam list" })).toBeNull();
  });

  it("shows the form after sign-in and reports with the chosen state and city", async () => {
    const user = userEvent.setup();
    ensureAnonymousUser.mockResolvedValue(anon);
    signInWithGoogle.mockResolvedValue(google);
    reportCheck.mockResolvedValue({ reportId: "r1", entityKeys: [] });
    open();
    await user.click(await screen.findByRole("button", { name: "Sign in with Google" }));
    await user.selectOptions(await screen.findByLabelText(/State or union territory/), "Maharashtra");
    await user.type(screen.getByLabelText(/City/), " Pune ");
    await user.click(screen.getByRole("button", { name: "Add to scam list" }));
    expect(reportCheck).toHaveBeenCalledWith("chk_123", { state: "Maharashtra", city: "Pune" });
    expect(await screen.findByText("Added to the scam list. Thank you.")).toBeInTheDocument();
  });

  it("goes straight to the form for a visitor already signed in with Google", async () => {
    ensureAnonymousUser.mockResolvedValue(google);
    open();
    expect(await screen.findByRole("button", { name: "Add to scam list" })).toBeEnabled();
  });

  it("says to re-run the check when Google sign-in switched to a different account", async () => {
    const user = userEvent.setup();
    ensureAnonymousUser.mockResolvedValue(anon);
    signInWithGoogle.mockResolvedValue({ uid: "other", providerData: [{ providerId: "google.com" }] });
    open();
    await user.click(await screen.findByRole("button", { name: "Sign in with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("run the check again");
  });

  it("stays quiet when the sign-in popup is closed", async () => {
    const user = userEvent.setup();
    ensureAnonymousUser.mockResolvedValue(anon);
    signInWithGoogle.mockRejectedValue(Object.assign(new Error("closed"), { code: "auth/popup-closed-by-user" }));
    open();
    await user.click(await screen.findByRole("button", { name: "Sign in with Google" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeEnabled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a friendly error when the report fails and lets the person retry", async () => {
    const user = userEvent.setup();
    ensureAnonymousUser.mockResolvedValue(google);
    reportCheck.mockRejectedValueOnce(new ApiError("internal_error", 500));
    open();
    await user.click(await screen.findByRole("button", { name: "Add to scam list" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't send the report");
    expect(screen.getByRole("button", { name: "Add to scam list" })).toBeEnabled();
  });
});

describe("reportErrorKey", () => {
  it("maps API codes to messages", () => {
    expect(reportErrorKey(new ApiError("google_sign_in_required", 403))).toBe("report.error.sessionChanged");
    expect(reportErrorKey(new ApiError("no_identifiers", 409))).toBe("report.error.noIds");
    expect(reportErrorKey(new ApiError("not_reportable", 409))).toBe("report.error.notReportable");
    expect(reportErrorKey(new ApiError("network", 0))).toBe("error.network");
    expect(reportErrorKey(new ApiError("boom", 500))).toBe("report.error.generic");
    expect(reportErrorKey(new TypeError("x"))).toBe("error.network");
  });
});
