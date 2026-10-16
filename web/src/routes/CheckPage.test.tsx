import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CheckPage from "./CheckPage";
import { setLang } from "@/i18n";
import { makeResult } from "@/test/fixtures";

const checkContent = vi.hoisted(() => vi.fn());
const uploadForCheck = vi.hoisted(() => vi.fn());
const takeSharedPayload = vi.hoisted(() => vi.fn());

vi.mock("@/share-target/sw-share", () => ({ takeSharedPayload }));

vi.mock("@/api", async () => {
  const actual = await vi.importActual<typeof import("@/api")>("@/api");
  return { ...actual, checkContent };
});

vi.mock("@/upload", async () => {
  const actual = await vi.importActual<typeof import("@/upload")>("@/upload");
  return { ...actual, uploadForCheck };
});

// Imported after the mock so ApiError is the real class.
import { ApiError } from "@/api";

function ResultProbe() {
  const loc = useLocation();
  const state = loc.state as { result?: { id: string } } | null;
  return <p>result page {loc.pathname} {state?.result?.id}</p>;
}

function renderCheck(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<CheckPage />} />
        <Route path="/result/:id" element={<ResultProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  checkContent.mockReset();
  uploadForCheck.mockReset();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: (f: File) => `blob:${f.name}` });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: () => {} });
  setLang("en");
});

describe("CheckPage", () => {
  it("links the message box to its character count and, at the limit, to the limit note", async () => {
    renderCheck();
    const box = screen.getByLabelText("The message");
    expect(box.getAttribute("aria-describedby")).toMatch(/-count$/);
    fireEvent.change(box, { target: { value: "x".repeat(5000) } });
    const ids = box.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[1]!)).toHaveTextContent("first 5,000 characters");
  });

  it("checks what was shared to the app, then opens the result", async () => {
    vi.stubGlobal("caches", {});
    takeSharedPayload.mockResolvedValue({ text: "KYC pending https://bnb-kyc-update.web.app", url: "https://bnb-kyc-update.web.app" });
    checkContent.mockResolvedValue(makeResult({ id: "shared1" }));
    try {
      renderCheck("/?shared=1");
      await waitFor(() => expect(checkContent).toHaveBeenCalledWith({ text: "KYC pending https://bnb-kyc-update.web.app", url: "https://bnb-kyc-update.web.app", lang: "en" }));
      await waitFor(() => expect(screen.getByText(/result page \/result\/shared1/)).toBeInTheDocument());
      expect(checkContent).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("runs the text example in one tap", async () => {
    const user = userEvent.setup();
    checkContent.mockResolvedValue(makeResult({ id: "ex1" }));
    renderCheck();
    await user.click(screen.getByRole("button", { name: "Fake KYC SMS with a bank link" }));
    expect(checkContent).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("bnb-kyc-update.web.app"), lang: "en" }),
    );
    await waitFor(() => expect(screen.getByText(/result page \/result\/ex1/)).toBeInTheDocument());
  });

  it("fetches, uploads and checks the image example with its caption", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["png"], { type: "image/png" })));
    vi.stubGlobal("fetch", fetchMock);
    uploadForCheck.mockResolvedValue({ storagePath: "uploads/u/x.png", mimeType: "image/png" });
    checkContent.mockResolvedValue(makeResult({ id: "ex2" }));
    try {
      renderCheck();
      await user.click(screen.getByRole("button", { name: /QR code to/ }));
      await waitFor(() => expect(checkContent).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith("/examples/qr-receive.png");
      expect(uploadForCheck.mock.calls[0]![0]).toMatchObject({ name: "qr-receive.png", type: "image/png" });
      expect(checkContent).toHaveBeenCalledWith({
        storagePath: "uploads/u/x.png",
        mimeType: "image/png",
        text: "Scan this QR to receive your ₹5,000 cashback",
        url: undefined,
        lang: "en",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows an error when an example file cannot be fetched", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    try {
      renderCheck();
      await user.click(screen.getByRole("button", { name: /Fake payment screenshot/ }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(checkContent).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("disables Check until there is a message or a link", async () => {
    const user = userEvent.setup();
    renderCheck();
    const button = screen.getByRole("button", { name: "Check" });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("The message"), "   ");
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("The message"), "Your KYC is expiring");
    expect(button).toBeEnabled();
  });

  it("enables Check when only a link is given", async () => {
    const user = userEvent.setup();
    renderCheck();
    await user.type(screen.getByLabelText(/A link you were sent/), "https://example.test/x");
    expect(screen.getByRole("button", { name: "Check" })).toBeEnabled();
  });

  it("sends the trimmed text and chosen language, then opens the result", async () => {
    const user = userEvent.setup();
    checkContent.mockResolvedValue(makeResult({ id: "abc" }));
    renderCheck();
    await user.type(screen.getByLabelText("The message"), "  pay now  ");
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(checkContent).toHaveBeenCalledWith({ text: "pay now", url: undefined, lang: "en" });
    await waitFor(() => expect(screen.getByText(/result page \/result\/abc abc/)).toBeInTheDocument());
  });

  it("shows progress while checking without losing keyboard focus", async () => {
    const user = userEvent.setup();
    checkContent.mockReturnValue(new Promise(() => {}));
    renderCheck();
    // The live region exists before anything happens so screen readers announce changes to it.
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();

    await user.type(screen.getByLabelText("The message"), "hello");
    const button = screen.getByRole("button", { name: "Check" });
    await user.click(button);

    expect(screen.getByRole("status")).toHaveTextContent("Checking… usually 5–15 seconds");
    // Busy, not disabled: a disabled button would drop keyboard focus.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    await user.click(button);
    expect(checkContent).toHaveBeenCalledTimes(1);
  });

  it("says it is taking longer after 20 seconds", async () => {
    vi.useFakeTimers();
    try {
      checkContent.mockReturnValue(new Promise(() => {}));
      renderCheck();
      fireEvent.change(screen.getByLabelText("The message"), { target: { value: "hello" } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
      expect(screen.getByRole("status")).toHaveTextContent("Checking…");

      act(() => {
        vi.advanceTimersByTime(19_000);
      });
      expect(screen.getByRole("status")).toHaveTextContent("Checking…");
      act(() => {
        vi.advanceTimersByTime(2_000);
      });
      expect(screen.getByRole("status")).toHaveTextContent("taking longer than usual");
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells the person when the 5,000 character limit is reached", () => {
    renderCheck();
    expect(screen.queryByText("Only the first 5,000 characters are checked.")).toBeNull();
    fireEvent.change(screen.getByLabelText("The message"), { target: { value: "a".repeat(5000) } });
    expect(screen.getByText("Only the first 5,000 characters are checked.")).toBeInTheDocument();
  });

  it("shows a friendly message for daily_limit", async () => {
    const user = userEvent.setup();
    checkContent.mockRejectedValue(new ApiError("daily_limit", 429));
    renderCheck();
    await user.type(screen.getByLabelText("The message"), "hello");
    await user.click(screen.getByRole("button", { name: "Check" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/reached today's limit/);
    expect(alert).not.toHaveTextContent("daily_limit");
    // The message stays so the person can try again later.
    expect(screen.getByLabelText("The message")).toHaveValue("hello");
    expect(screen.getByRole("button", { name: "Check" })).toBeEnabled();
  });

  it.each([
    ["rate_limited", /too fast/],
    ["analysis_failed", /couldn't analyse/],
    ["empty_input", /Paste a message or a link/],
    ["text_too_long", /too long/],
    ["bad_url", /valid link/],
    ["unsupported_type", /screenshot \(PNG, JPEG or WebP\) or a voice note/],
    ["file_too_large", /too large/],
    ["unauthorized", /reload the page/],
    ["network", /Can't reach the server/],
    ["something_new", /Something went wrong/],
  ])("maps %s to a friendly message", async (code, expected) => {
    const user = userEvent.setup();
    checkContent.mockRejectedValue(new ApiError(code, 400));
    renderCheck();
    await user.type(screen.getByLabelText("The message"), "hello");
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
  });

  it("treats a thrown network TypeError as a connection problem", async () => {
    const user = userEvent.setup();
    checkContent.mockRejectedValue(new TypeError("Failed to fetch"));
    renderCheck();
    await user.type(screen.getByLabelText("The message"), "hello");
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Can't reach the server/);
  });

  describe("file uploads", () => {
    const png = () => new File(["x"], "scan.png", { type: "image/png" });
    const fileInput = () => screen.getByTestId("file-input") as HTMLInputElement;

    it("lets you check with only a file attached, and disables Check again after removing it", async () => {
      const user = userEvent.setup();
      renderCheck();
      const button = screen.getByRole("button", { name: "Check" });
      expect(button).toBeDisabled();
      await user.upload(fileInput(), png());
      expect(button).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "Remove scan.png" }));
      expect(button).toBeDisabled();
    });

    it("uploads first, then sends storagePath, mimeType and the typed text", async () => {
      const user = userEvent.setup();
      uploadForCheck.mockResolvedValue({ storagePath: "uploads/u1/abc.png", mimeType: "image/png" });
      checkContent.mockResolvedValue(makeResult({ id: "q1" }));
      renderCheck();
      await user.type(screen.getByLabelText("The message"), "  scan to receive money  ");
      await user.upload(fileInput(), png());
      await user.click(screen.getByRole("button", { name: "Check" }));

      expect(uploadForCheck).toHaveBeenCalledTimes(1);
      expect(uploadForCheck.mock.calls[0]![0]).toBeInstanceOf(File);
      expect(checkContent).toHaveBeenCalledWith({
        storagePath: "uploads/u1/abc.png",
        mimeType: "image/png",
        text: "scan to receive money",
        url: undefined,
        lang: "en",
      });
      await waitFor(() => expect(screen.getByText(/result page \/result\/q1 q1/)).toBeInTheDocument());
    });

    it("shows upload progress in the live region and a progress bar", async () => {
      const user = userEvent.setup();
      let report: (f: number) => void = () => {};
      uploadForCheck.mockImplementation((_f: File, opts?: { onProgress?: (f: number) => void }) => {
        report = opts?.onProgress ?? (() => {});
        return new Promise(() => {});
      });
      renderCheck();
      await user.upload(fileInput(), png());
      await user.click(screen.getByRole("button", { name: "Check" }));

      expect(screen.getByRole("status")).toHaveTextContent("Uploading your file");
      act(() => report(0.6));
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
      expect(screen.getByRole("status")).toHaveTextContent("Uploading your file… 50%");
      expect(checkContent).not.toHaveBeenCalled();
      // One file only, and no changes while it is on its way.
      expect(screen.getByRole("button", { name: "Remove scan.png" })).toHaveAttribute("aria-disabled", "true");
    });

    it("shows a friendly alert when the upload fails and keeps the file for a retry", async () => {
      const user = userEvent.setup();
      uploadForCheck.mockRejectedValue(new ApiError("upload_failed"));
      renderCheck();
      await user.upload(fileInput(), png());
      await user.click(screen.getByRole("button", { name: "Check" }));

      expect(await screen.findByText(/couldn't upload that file/)).toBeInTheDocument();
      expect(checkContent).not.toHaveBeenCalled();
      expect(screen.getByText("scan.png")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Check" })).toBeEnabled();
    });

    it("does not upload the same file twice when the check itself fails and is retried", async () => {
      const user = userEvent.setup();
      uploadForCheck.mockResolvedValue({ storagePath: "uploads/u1/abc.png", mimeType: "image/png" });
      checkContent.mockRejectedValueOnce(new ApiError("analysis_failed", 502)).mockResolvedValueOnce(makeResult({ id: "r2" }));
      renderCheck();
      await user.upload(fileInput(), png());
      await user.click(screen.getByRole("button", { name: "Check" }));
      expect(await screen.findByText(/couldn't analyse/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Check" }));
      await waitFor(() => expect(screen.getByText(/result page \/result\/r2/)).toBeInTheDocument());
      expect(uploadForCheck).toHaveBeenCalledTimes(1);
      expect(checkContent).toHaveBeenCalledTimes(2);
    });

    it("rejects a PDF right away under the drop zone and keeps Check disabled", () => {
      renderCheck();
      fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [new File(["x"], "bill.pdf", { type: "application/pdf" })], types: ["Files"] } });
      expect(screen.getByRole("alert")).toHaveTextContent(/Please send a screenshot \(PNG, JPEG or WebP\)/);
      expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    });

    it("keeps only one file: a second one replaces the first", async () => {
      const user = userEvent.setup();
      renderCheck();
      await user.upload(fileInput(), png());
      await user.upload(fileInput(), new File(["a"], "note.ogg", { type: "audio/ogg" }));
      expect(screen.queryByText("scan.png")).toBeNull();
      expect(screen.getByText("note.ogg")).toBeInTheDocument();
    });

    it("does not start a second upload when Check is pressed again while uploading", async () => {
      const user = userEvent.setup();
      uploadForCheck.mockReturnValue(new Promise(() => {}));
      renderCheck();
      await user.upload(fileInput(), png());
      const button = screen.getByRole("button", { name: "Check" });
      await user.click(button);
      await user.click(button);
      fireEvent.submit(button.closest("form")!);
      expect(uploadForCheck).toHaveBeenCalledTimes(1);
    });

    it("also starts only one upload when submitted twice in the same tick", () => {
      uploadForCheck.mockReturnValue(new Promise(() => {}));
      renderCheck();
      fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [png()], types: ["Files"] } });
      const form = screen.getByRole("button", { name: "Check" }).closest("form")!;
      fireEvent.submit(form);
      fireEvent.submit(form);
      expect(uploadForCheck).toHaveBeenCalledTimes(1);
    });

    it("shows an enabled Cancel button during the upload that aborts it and leaves the file attached", async () => {
      const user = userEvent.setup();
      let signal: AbortSignal | undefined;
      uploadForCheck.mockImplementation((_f: File, opts?: { signal?: AbortSignal }) => {
        signal = opts?.signal;
        return new Promise((_res, rej) => opts?.signal?.addEventListener("abort", () => rej(new ApiError("canceled"))));
      });
      renderCheck();
      expect(screen.queryByRole("button", { name: "Cancel upload" })).toBeNull();
      await user.upload(fileInput(), png());
      await user.click(screen.getByRole("button", { name: "Check" }));

      const cancel = screen.getByRole("button", { name: "Cancel upload" });
      expect(cancel).toBeEnabled();
      expect(cancel).not.toHaveAttribute("aria-disabled");
      await user.click(cancel);

      expect(signal?.aborted).toBe(true);
      expect(checkContent).not.toHaveBeenCalled();
      // No error alert for something the person chose, the file is still there, and Check works again.
      await waitFor(() => expect(screen.getByRole("button", { name: "Check" })).toBeEnabled());
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByText("scan.png")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancel upload" })).toBeNull();
      expect(screen.getByRole("button", { name: "Check" })).toHaveFocus();
    });

    it("aborts the upload when the page is left", async () => {
      const user = userEvent.setup();
      let signal: AbortSignal | undefined;
      uploadForCheck.mockImplementation((_f: File, opts?: { signal?: AbortSignal }) => {
        signal = opts?.signal;
        return new Promise(() => {});
      });
      const { unmount } = renderCheck();
      await user.upload(fileInput(), png());
      await user.click(screen.getByRole("button", { name: "Check" }));
      expect(signal?.aborted).toBe(false);
      unmount();
      expect(signal?.aborted).toBe(true);
    });

    it("shows the slow notice during a slow upload, then times the check phase separately", async () => {
      vi.useFakeTimers();
      try {
        let finish: (v: { storagePath: string; mimeType: string }) => void = () => {};
        uploadForCheck.mockReturnValue(new Promise((res) => (finish = res)));
        checkContent.mockReturnValue(new Promise(() => {}));
        renderCheck();
        fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [png()], types: ["Files"] } });
        fireEvent.click(screen.getByRole("button", { name: "Check" }));
        expect(screen.getByRole("status")).toHaveTextContent("Uploading your file");
        expect(screen.getByRole("status")).not.toHaveTextContent("taking longer than usual");

        act(() => {
          vi.advanceTimersByTime(21_000);
        });
        expect(screen.getByRole("status")).toHaveTextContent("Uploading your file");
        expect(screen.getByRole("status")).toHaveTextContent("taking longer than usual");

        // The check phase starts a fresh 20 second clock.
        await act(async () => {
          finish({ storagePath: "uploads/u/x.png", mimeType: "image/png" });
        });
        expect(screen.getByRole("status")).toHaveTextContent("Checking…");
        expect(screen.getByRole("status")).not.toHaveTextContent("taking longer than usual");
        act(() => {
          vi.advanceTimersByTime(19_000);
        });
        expect(screen.getByRole("status")).not.toHaveTextContent("taking longer than usual");
        act(() => {
          vi.advanceTimersByTime(2_000);
        });
        expect(screen.getByRole("status")).toHaveTextContent("taking longer than usual");
      } finally {
        vi.useRealTimers();
      }
    });

    it("stops the browser opening a file dropped outside the zone, but only while this page is shown", () => {
      const { unmount } = renderCheck();
      const fire = (type: string, types: string[]) => {
        const e = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(e, "dataTransfer", { value: { types, files: [] } });
        document.body.dispatchEvent(e);
        return e;
      };
      expect(fire("drop", ["Files"]).defaultPrevented).toBe(true);
      expect(fire("dragover", ["Files"]).defaultPrevented).toBe(true);
      // Dragging text (for example into the message box) is left alone.
      expect(fire("drop", ["text/plain"]).defaultPrevented).toBe(false);

      unmount();
      expect(fire("drop", ["Files"]).defaultPrevented).toBe(false);
    });

    it("still attaches a file dropped on the zone itself", () => {
      renderCheck();
      fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [png()], types: ["Files"] } });
      expect(screen.getByText("scan.png")).toBeInTheDocument();
    });

    it("keeps pasting text into the message box working", async () => {
      const user = userEvent.setup();
      renderCheck();
      const box = screen.getByLabelText("The message");
      await user.click(box);
      await user.paste("Your KYC is expiring");
      expect(box).toHaveValue("Your KYC is expiring");
      expect(screen.queryByText("scan.png")).toBeNull();
    });
  });

  it("sends lang hi when Hindi is selected", async () => {
    const user = userEvent.setup();
    setLang("hi");
    checkContent.mockResolvedValue(makeResult({ id: "h1", language: "hi" }));
    renderCheck();
    await user.type(screen.getByLabelText("मैसेज"), "नमस्ते");
    await user.click(screen.getByRole("button", { name: "जाँचें" }));
    expect(checkContent).toHaveBeenCalledWith({ text: "नमस्ते", url: undefined, lang: "hi" });
  });
});
