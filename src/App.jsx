import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import AuthGate from "./components/AuthGate";
import Dashboard from "./pages/Dashboard";
import "./theme.css";
import "./layout.css";

export default function App() {
  const [activePage, setActivePage] = useState("overview");
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

  if (authState === "checking") return <div className="app-loading">Loading secure dashboard…</div>;
  if (authState !== "authenticated") return <AuthGate onAuthenticated={() => setAuthState("authenticated")} />;

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="app-main">
        <Topbar theme={theme} onToggleTheme={toggleTheme} onLogout={logout} />
        <main className="app-content"><Dashboard activePage={activePage} theme={theme} onToggleTheme={toggleTheme} /></main>
      </div>
    </div>
  );
}
