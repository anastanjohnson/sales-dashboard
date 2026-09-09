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
  const [authState, setAuthState] = useState("checking");
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
      .then((result) => setAuthState(result.authenticated ? "authenticated" : "guest"))
      .catch(() => setAuthState("guest"));
  }, []);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    setAuthState("guest");
  };

  const toggleTheme = () => setTheme((value) => value === "dark" ? "light" : "dark");
  const navigate = (page) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  if (authState === "checking") return <div className="app-loading">Loading secure dashboard…</div>;
  if (authState !== "authenticated") return <AuthGate onAuthenticated={() => setAuthState("authenticated")} />;

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
