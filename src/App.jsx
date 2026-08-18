import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";
import "./theme.css";
import "./layout.css";

export default function App() {
    const [theme, setTheme] = useState(() => {
          if (typeof window !== "undefined" && window.matchMedia) {
                  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
          }
          return "light";
    });

  useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
        <div className="app-shell">
          <Sidebar />
          <div className="app-main">
            <Topbar theme={theme} onToggleTheme={toggleTheme} />
            <main className="app-content">
              <Dashboard />
            </main></div>
        </div>
);
}
