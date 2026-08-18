import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import LoginGate from "./components/AuthGate";
import Dashboard from "./pages/Dashboard";
import "./theme.css";
import "./layout.css";

export default function App() {
  const [activePage, setActivePage] = useState("sales-salary");
  const [salaryData, setSalaryData] = useState(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((value) => (value === "dark" ? "light" : "dark"));

  if (!salaryData) return <LoginGate onAuthenticated={setSalaryData} />;

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="app-main">
        <Topbar theme={theme} onToggleTheme={toggleTheme} />
        <main className="app-content">
          <Dashboard activePage={activePage} salaryData={salaryData} />
        </main>
      </div>
    </div>
  );
}
