import { Moon, ShieldCheck, Sun } from "lucide-react";

export default function SettingsPage({ theme, onToggleTheme }) {
  return <div className="dashboard settings-page">
    <div className="dashboard__header"><div><h1>Setting</h1><p className="dashboard__subtitle">Dashboard appearance and security information.</p></div></div>
    <div className="panel settings-panel">
      <div className="settings-panel__row">
        <div><h3>Appearance</h3><p>Switch between light and dark dashboard themes.</p></div>
        <button className="btn btn--ghost" type="button" onClick={onToggleTheme}>{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}{theme === "dark" ? "Use light mode" : "Use dark mode"}</button>
      </div>
    </div>
    <div className="panel settings-panel">
      <div className="settings-panel__row">
        <div><h3>Protected dashboard</h3><p>Salary and weekly performance data remain behind the secure login.</p></div>
        <ShieldCheck size={22} className="settings-panel__security-icon" />
      </div>
    </div>
  </div>;
}
