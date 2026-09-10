import { Search, Sun, Moon, Bell, LogOut, Menu } from "lucide-react";

export default function Topbar({ theme, onToggleTheme, onLogout, onOpenMenu, menuOpen, restricted = false }) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        {!restricted && <button
          className="icon-btn topbar__menu"
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
        >
          <Menu size={18} />
        </button>}
        {restricted ? <div className="topbar__restricted-title">KARIKAALA · Salary Payment</div> : <div className="topbar__search"><Search size={16} /><input type="text" placeholder="Search..." aria-label="Search" /></div>}
      </div>
      <div className="topbar__actions">
        <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme" title="Toggle light / dark theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
        <button className="icon-btn" aria-label="Notifications"><Bell size={17} /></button>
        <button className="icon-btn" onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
      </div>
    </header>
  );
}
