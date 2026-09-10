import { useEffect, useState } from "react";
import Sidebar, { MobileNavigation } from "./components/Sidebar";
import Topbar from "./components/Topbar";
import AuthGate from "./components/AuthGate";
import Dashboard from "./pages/Dashboard";
import "./theme.css";
import "./layout.css";

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
    fetch("/api/session", { credentials: "include" })
      .then((response) => response.json())
      .then((result) => setAuthState({ status: result.authenticated ? "authenticated" : "guest", role: result.role || null }))
      .catch(() => setAuthState({ status: "guest", role: null }));
  }, []);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
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
    return (
      <div className="restricted-app">
        <Topbar theme={theme} onToggleTheme={toggleTheme} onLogout={logout} restricted />
        <main className="app-content"><Dashboard activePage="salary-payment" theme={theme} onToggleTheme={toggleTheme} /></main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={navigate} />
      <MobileNavigation
        activePage={activePage}
        onNavigate={navigate}
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
        <main className="app-content"><Dashboard activePage={activePage} theme={theme} onToggleTheme={toggleTheme} onNavigate={navigate} /></main>
      </div>
    </div>
  );
}
