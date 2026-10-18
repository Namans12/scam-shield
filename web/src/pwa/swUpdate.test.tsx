import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { setLang } from "@/i18n";

class FakeContainer extends EventTarget {
  controller: object | null;
  registration: (EventTarget & { waiting: { postMessage: ReturnType<typeof vi.fn> } | null; installing: (EventTarget & { state: string }) | null }) | undefined;
  constructor(controller: object | null) {
    super();
    this.controller = controller;
  }
  getRegistration = () => Promise.resolve(this.registration as unknown as ServiceWorkerRegistration | undefined);
  takeControl() {
    this.controller = {};
    this.dispatchEvent(new Event("controllerchange"));
  }
}

function install(container: FakeContainer) {
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });
}

const reload = vi.fn();
const original = window.location;
beforeEach(() => {
  setLang("en");
  reload.mockReset();
  Object.defineProperty(window, "location", { configurable: true, value: { ...original, reload } });
});
afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: original });
  // @ts-expect-error remove the fake so other tests see jsdom's default (no service worker support)
  delete navigator.serviceWorker;
});

const flush = () => act(async () => { await Promise.resolve(); });

describe("UpdatePrompt", () => {
  it("renders nothing when service workers are unsupported", async () => {
    render(<UpdatePrompt />);
    await flush();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not show on first install (page was uncontrolled, worker claims it)", async () => {
    const sw = new FakeContainer(null);
    install(sw);
    render(<UpdatePrompt />);
    await flush();
    act(() => sw.takeControl());
    expect(screen.queryByText("New version available.")).toBeNull();
  });

  it("shows the prompt when a new worker takes over a controlled page, and Refresh reloads", async () => {
    const user = userEvent.setup();
    const sw = new FakeContainer({});
    install(sw);
    render(<UpdatePrompt />);
    await flush();
    expect(screen.queryByText("New version available.")).toBeNull();
    act(() => sw.takeControl());
    expect(screen.getByText("New version available.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await flush();
    expect(reload).toHaveBeenCalled();
  });

  it("can be dismissed without reloading", async () => {
    const user = userEvent.setup();
    const sw = new FakeContainer({});
    install(sw);
    render(<UpdatePrompt />);
    await flush();
    act(() => sw.takeControl());
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("New version available.")).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("shows for a waiting worker and Refresh asks it to take over before reloading", async () => {
    const user = userEvent.setup();
    const sw = new FakeContainer({});
    const waiting = { postMessage: vi.fn() };
    sw.registration = Object.assign(new EventTarget(), { waiting, installing: null });
    install(sw);
    render(<UpdatePrompt />);
    await flush();
    expect(screen.getByText("New version available.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await flush();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    act(() => sw.takeControl());
    expect(reload).toHaveBeenCalled();
  });

  it("shows when an update is installed while the page is open", async () => {
    const sw = new FakeContainer({});
    const installing = Object.assign(new EventTarget(), { state: "installing" });
    sw.registration = Object.assign(new EventTarget(), { waiting: null, installing });
    install(sw);
    render(<UpdatePrompt />);
    await flush();
    act(() => {
      sw.registration!.dispatchEvent(new Event("updatefound"));
      installing.state = "installed";
      installing.dispatchEvent(new Event("statechange"));
    });
    expect(screen.getByText("New version available.")).toBeInTheDocument();
  });

  it("is available in Hindi", async () => {
    setLang("hi");
    const sw = new FakeContainer({});
    install(sw);
    render(<UpdatePrompt />);
    await flush();
    act(() => sw.takeControl());
    expect(screen.getByText("नया वर्शन उपलब्ध है।")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "रीफ़्रेश करें" })).toBeInTheDocument();
  });
});
