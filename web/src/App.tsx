import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/AppShell";
import CheckPage from "@/routes/CheckPage";
import ResultPage from "@/routes/ResultPage";
import AboutPage from "@/routes/AboutPage";
import ComingSoonPage from "@/routes/ComingSoonPage";
import NotFoundPage from "@/routes/NotFoundPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<CheckPage />} />
            <Route path="/result/:id" element={<ResultPage />} />
            <Route path="/trends" element={<ComingSoonPage titleKey="trends.title" />} />
            <Route path="/history" element={<ComingSoonPage titleKey="history.title" />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}
