import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import LandingPage from "./LandingPage";
import { setLang, translate } from "@/i18n";
import type { Lang } from "@scam-shield/shared";

function CheckDestination() {
  const { pathname, search, hash } = useLocation();
  return <p>{pathname}{search}{hash}</p>;
}
function renderLanding(entry = "/") {
  return render(<MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/" element={<LandingPage />} /><Route path="/check" element={<CheckDestination />} /></Routes></MemoryRouter>);
}
beforeEach(() => { setLang("en"); });

describe("LandingPage", () => {
  for (const lang of ["en", "hi"] as Lang[]) {
    it(`renders the key sections in ${lang}, with guidance and no prohibited wording`, () => {
      setLang(lang);
      const { container } = renderLanding();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(translate(lang, "landing.title"));
      for (const key of ["landing.inputsTitle", "landing.stepsTitle", "landing.actionTitle", "landing.examplesTitle", "landing.proofTitle", "landing.finalTitle"] as const) {
        expect(screen.getByRole("heading", { name: translate(lang, key), level: 2 })).toBeInTheDocument();
      }
      expect(screen.getByText(translate(lang, "landing.footerNote"))).toBeInTheDocument();
      expect(screen.getByRole("link", { name: translate(lang, "landing.helpline") })).toHaveAttribute("href", "tel:1930");
      expect(container.textContent).not.toMatch(/\bsafe\b|सुरक्षित/i);
      expect(container.querySelectorAll("h1")).toHaveLength(1);
      expect(screen.getByRole("radiogroup", { name: translate(lang, "lang.label") })).toBeInTheDocument();
    });
  }
  it("links every primary CTA to /check and every example to its agreed query", () => {
    renderLanding();
    for (const link of screen.getAllByRole("link", { name: "Check a message" })) expect(link).toHaveAttribute("href", "/check");
    expect(screen.getByRole("link", { name: "See an example" })).toHaveAttribute("href", "/check?example=kyc_sms");
    for (const id of ["kyc_sms", "fake_payment", "qr_receive", "digital_arrest"] as const) {
      expect(screen.getByRole("link", { name: new RegExp(translate("en", `example.${id}`).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toHaveAttribute("href", `/check?example=${id}`);
    }
    expect(screen.getByRole("link", { name: "Check" })).toHaveAttribute("href", "/check");
  });
  it("switches languages using the full English / हिंदी labels", async () => {
    const user = userEvent.setup();
    renderLanding();
    await user.click(screen.getByRole("radio", { name: "हिंदी" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("रुकें। जाँचें।");
    expect(document.documentElement).toHaveAttribute("lang", "hi");
    await user.click(screen.getByRole("radio", { name: "English" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pause. Check.");
  });
  it("supports arrow-key navigation for the language control", async () => {
    const user = userEvent.setup();
    renderLanding();
    screen.getByRole("radio", { name: "English" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "हिंदी" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "हिंदी" })).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "English" })).toHaveFocus();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pause. Check.");
  });
  it("redirects Android shares to /check while preserving the full query and hash", () => {
    renderLanding("/?shared=1&text=hello%20there&url=https%3A%2F%2Fexample.com#upload");
    expect(screen.getByText("/check?shared=1&text=hello%20there&url=https%3A%2F%2Fexample.com#upload")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
  it("does not redirect other shared values", () => {
    renderLanding("/?shared=0");
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
