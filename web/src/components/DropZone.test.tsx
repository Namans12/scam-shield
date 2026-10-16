import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DropZone } from "./DropZone";
import { setLang } from "@/i18n";

const createObjectURL = vi.fn((f: File) => `blob:${f.name}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  setLang("en");
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: revokeObjectURL });
});

afterEach(() => {
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
});

function Harness({ onChange, disabled, progress }: { onChange?: (f: File | null) => void; disabled?: boolean; progress?: number | null }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <>
      <textarea aria-label="caption" />
      <DropZone
        file={file}
        disabled={disabled}
        progress={progress}
        onFileChange={(f) => {
          setFile(f);
          onChange?.(f);
        }}
      />
    </>
  );
}

const png = () => new File(["x".repeat(2048)], "screenshot.png", { type: "image/png" });
const input = () => screen.getByTestId("file-input") as HTMLInputElement;

function paste(target: Element | Document, data: { files?: File[]; text?: string }) {
  const files = data.files ?? [];
  const clipboardData = {
    files,
    items: files.map((f) => ({ kind: "file", type: f.type, getAsFile: () => f })),
    types: [...(files.length ? ["Files"] : []), ...(data.text ? ["text/plain"] : [])],
    getData: (t: string) => (t === "text/plain" ? (data.text ?? "") : ""),
  };
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: clipboardData });
  target.dispatchEvent(event);
  return event;
}

describe("DropZone", () => {
  it("offers a file picker without forcing the camera", () => {
    render(<Harness />);
    expect(input()).toHaveAttribute("accept", "image/png,image/jpeg,image/webp,audio/*");
    expect(input()).not.toHaveAttribute("capture");
    expect(input()).not.toHaveAttribute("multiple");
    expect(screen.getByRole("button", { name: /Choose a file or photo/ })).toBeInTheDocument();
    expect(screen.getByText(/add a screenshot, QR code or voice note/i)).toBeInTheDocument();
  });

  it("shows a thumbnail, the name and size, and removes the file", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.upload(input(), png());

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: "screenshot.png" }));
    const img = screen.getByRole("img", { name: /screenshot\.png/ });
    expect(img).toHaveAttribute("src", "blob:screenshot.png");
    expect(screen.getByText("screenshot.png")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove screenshot.png" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole("img")).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:screenshot.png");
  });

  it("shows an audio player for a voice note", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.upload(input(), new File(["a"], "note.ogg", { type: "audio/ogg" }));
    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio).toHaveAttribute("controls");
    expect(audio).toHaveAttribute("src", "blob:note.ogg");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("rejects a PDF with a friendly message and does not attach it", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    // A drop skips the picker's accept filter, so it is the way an unsupported file gets in.
    fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [new File(["x"], "doc.pdf", { type: "application/pdf" })], types: ["Files"] } });
    expect(screen.getByRole("alert")).toHaveTextContent("We can't read that type of file.");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText("doc.pdf")).toBeNull();
  });

  it("rejects a file that is too large", () => {
    render(<Harness />);
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 10 * 1024 * 1024 + 1 });
    fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [big], types: ["Files"] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/too large/);
  });

  it("clears the error when a good file is chosen", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [new File(["x"], "doc.pdf", { type: "application/pdf" })], types: ["Files"] } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.upload(input(), png());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("accepts a dropped file and highlights the zone while dragging", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const zone = screen.getByTestId("dropzone");
    const file = png();
    fireEvent.dragEnter(zone, { dataTransfer: { files: [file], types: ["Files"] } });
    expect(zone).toHaveAttribute("data-dragging", "true");
    fireEvent.drop(zone, { dataTransfer: { files: [file], types: ["Files"] } });
    expect(zone).not.toHaveAttribute("data-dragging", "true");
    expect(onChange).toHaveBeenCalledWith(file);
  });

  it("accepts a pasted image", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const file = new File(["x"], "image.png", { type: "image/png" });
    const event = paste(document, { files: [file] });
    expect(onChange).toHaveBeenCalledWith(file);
    expect(event.defaultPrevented).toBe(true);
  });

  it("accepts a pasted screenshot while the caption box has focus", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const box = screen.getByLabelText("caption");
    box.focus();
    const file = new File(["x"], "image.png", { type: "image/png" });
    paste(box, { files: [file] });
    expect(onChange).toHaveBeenCalledWith(file);
  });

  it("ignores pasted plain text so pasting a message keeps working", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const box = screen.getByLabelText("caption");
    box.focus();
    const event = paste(box, { text: "Your KYC is expiring" });
    expect(onChange).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("keeps text paste working when the clipboard has both an image and text, in a text box", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const box = screen.getByLabelText("caption");
    box.focus();
    const event = paste(box, { files: [new File(["x"], "image.png", { type: "image/png" })], text: "copied cell" });
    expect(onChange).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores pasted files that are not images", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    paste(document, { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores paste and drops while disabled, and stops listening when unmounted", () => {
    const onChange = vi.fn();
    const { unmount } = render(<Harness onChange={onChange} disabled />);
    paste(document, { files: [new File(["x"], "image.png", { type: "image/png" })] });
    fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [png()], types: ["Files"] } });
    expect(onChange).not.toHaveBeenCalled();
    unmount();
    paste(document, { files: [png()] });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows an upload progress bar with aria-valuenow once a file is attached", async () => {
    const user = userEvent.setup();
    render(<Harness progress={0.4} />);
    expect(screen.queryByRole("progressbar")).toBeNull(); // nothing attached yet
    await user.upload(input(), png());
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("revokes the preview URL on unmount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await user.upload(input(), png());
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:screenshot.png");
  });
});
