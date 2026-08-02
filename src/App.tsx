import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { HashRouter, Routes, Route } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import Landing from "./pages/Landing";
import StudentDashboard from "./pages/StudentDashboard";
import InstitutionDashboard from "./pages/InstitutionDashboard";
import VerifierPage from "./pages/VerifierPage";
import NotFound from "./pages/NotFound";
import PortalConnect from "./pages/PortalConnect";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={200}>
        <Toaster />
        <Sonner />
        {/* HashRouter keeps share links and QR payloads self-contained in the
            fragment, so a scanned credential never reaches a server log. */}
        <HashRouter>
          <div className="flex min-h-screen flex-col">
            <Navigation />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Landing />} />

                <Route path="/student-portal" element={<PortalConnect role="student" />} />
                <Route path="/student-dashboard" element={<StudentDashboard />} />

                <Route path="/institution-portal" element={<PortalConnect role="institution" />} />
                <Route path="/institution-dashboard" element={<InstitutionDashboard />} />

                <Route path="/verify" element={<VerifierPage />} />

                {/* Keep the catch-all last. */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </HashRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
