import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/AppShell";
import LandingPage from "@/routes/LandingPage";
import { useT } from "@/i18n";
const CheckPage = lazy(() => import("@/routes/CheckPage"));
const ResultPage = lazy(() => import("@/routes/ResultPage"));
const ComplaintPage = lazy(() => import("@/routes/ComplaintPage"));
const AboutPage = lazy(() => import("@/routes/AboutPage"));
const TrendsPage = lazy(() => import("@/routes/TrendsPage"));
const HistoryPage = lazy(() => import("@/routes/HistoryPage"));
const NotFoundPage = lazy(() => import("@/routes/NotFoundPage"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const t = useT();
  return (
    <TooltipProvider>
      <Toaster />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <Suspense fallback={<div className="route-loading" role="status" aria-label={t("landing.loading")}><span /></div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route element={<AppShell />}>
              <Route path="/check" element={<CheckPage />} />
              <Route path="/result/:id" element={<ResultPage />} />
              <Route path="/complaint/:id" element={<ComplaintPage />} />
              <Route path="/trends" element={<TrendsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  );
}
