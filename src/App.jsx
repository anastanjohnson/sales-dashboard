import { apiFetch } from "./api.js";
import { useEffect, useState } from "react";
import Sidebar, { MobileNavigation } from "./components/Sidebar";
import Topbar from "./components/Topbar";
import AuthGate from "./components/AuthGate";
import Dashboard from "./pages/Dashboard";
import "./theme.css";
import "./layout.css";
import "./pages/MonthlyMenuRefreshPage.css";

export default function App() {
  const [activePage, setActivePage] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authState, setAuthState] = useState({ status: "checking", role: null });
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    apiFetch("/api/session", { credentials: "include" })
      .then((response) => response.json())
      .then((result) => setAuthState({ status: result.authenticated ? "authenticated" : "guest", role: result.role || null }))
      .catch(() => setAuthState({ status: "guest", role: null }));
  }, []);

  const logout = async () => {
    await import("./planner/store").then(m => m.closePlannerSession()).catch(() => {});
    await apiFetch("/api/logout", { method: "POST", credentials: "include" });
    setAuthState({ status: "guest", role: null });
  };

  const toggleTheme = () => setTheme((value) => value === "dark" ? "light" : "dark");
  const navigate = (page) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  if (authState.status === "checking") return <div className="app-loading">Loading secure dashboard…</div>;
  if (authState.status !== "authenticated") return <AuthGate onAuthenticated={(role) => setAuthState({ status: "authenticated", role })} />;

  if (authState.role === "salary-payment") {
    const restrictedPage = activePage === "monthly-menu-refresh" ? "monthly-menu-refresh" : "salary-payment";
    return (
      <div className="restricted-app">
        <Topbar theme={theme} onToggleTheme={toggleTheme} onLogout={logout} restricted />
        <nav className="anastan-workspace-nav" aria-label="Anastan workspace">
          <button type="button" aria-pressed={restrictedPage === "salary-payment"} onClick={() => navigate("salary-payment")}>Salary Payment</button>
          <button type="button" aria-pressed={restrictedPage === "monthly-menu-refresh"} onClick={() => navigate("monthly-menu-refresh")}>Monthly Menu Refresh</button>
        </nav>
        <main className="app-content"><Dashboard activePage={restrictedPage} theme={theme} onToggleTheme={toggleTheme} role={authState.role} /></main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={navigate} theme={theme} onToggleTheme={toggleTheme} onLogout={logout} />
      <MobileNavigation
        activePage={activePage}
        onNavigate={navigate}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={logout}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <div className="app-main">
        <Topbar
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogout={logout}
          onOpenMenu={() => setMobileMenuOpen(true)}
          menuOpen={mobileMenuOpen}
        />
        <main className="app-content"><Dashboard activePage={activePage} theme={theme} onToggleTheme={toggleTheme} onNavigate={navigate} role={authState.role} /></main>
      </div>
    </div>
  );
}
