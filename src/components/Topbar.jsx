import { Sun, Moon, Bell, LogOut, Menu } from "lucide-react";

export function AccountActions({ theme, onToggleTheme, onLogout, tabIndex }) {
  return (
    <div className="topbar__actions" role="group" aria-label="Account controls">
      <button type="button" className="icon-btn" onClick={onToggleTheme} tabIndex={tabIndex} aria-label="Toggle theme" title="Toggle light / dark theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
      <button type="button" className="icon-btn" tabIndex={tabIndex} aria-label="Notifications" title="Notifications"><Bell size={17} /></button>
      <button type="button" className="icon-btn" onClick={onLogout} tabIndex={tabIndex} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
    </div>
  );
}

export default function Topbar({ theme, onToggleTheme, onLogout, onOpenMenu, menuOpen, restricted = false }) {
  if (!restricted) return (
    <div className="mobile-menu-bar">
      <button className="icon-btn" type="button" onClick={onOpenMenu} aria-label="Open navigation" aria-expanded={menuOpen}><Menu size={18} /></button>
    </div>
  );
  return (
    <header className="topbar">
      <div className="topbar__restricted-title">KARIKAALA · Salary Payment</div>
      <AccountActions theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout} />
    </header>
  );
}
