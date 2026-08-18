import { Search, Sun, Moon, Bell, User } from "lucide-react";

export default function Topbar({ theme, onToggleTheme }) {
    return (
        <header className="topbar">
              <div className="topbar__search">
                      <Search size={16} />
                      <input type="text" placeholder="Search..." aria-label="Search" />
              </div>
              <div className="topbar__actions">
                      <button
                                  className="icon-btn"
                                  onClick={onToggleTheme}
                                  aria-label="Toggle theme"
                                  title="Toggle light / dark theme"
                                >
                        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                      </button>
                      <button className="icon-btn" aria-label="Notifications">
                                <Bell size={17} />
                      </button>
                      <button className="icon-btn icon-btn--avatar" aria-label="Account">
                                <User size={17} />
                      </button>
              </div>
        </header>
        );
}
