import {
    LayoutGrid,
    Euro,
    ChartLine,
    RefreshCcw,
    Banknote,
    WalletCards,
    Clock3,
    Settings,
    ChevronLeft,
    ChevronRight,
    X,
} from "lucide-react";
import { useState } from "react";

export const NAV_ITEMS = [
    { icon: LayoutGrid, label: "Dashboard", page: "overview" },
  { icon: Euro, label: "Sales Revenue", page: "sales" },
    { icon: ChartLine, label: "Weekly Performance", page: "weekly-performance" },
    { icon: RefreshCcw, label: "Repeated Guest", page: "repeated-guests" },
    { icon: Banknote, label: "Salary", page: "sales-salary" },
    { icon: WalletCards, label: "Salary Payment", page: "salary-payment" },
    { icon: Clock3, label: "Staff Hours", page: "staff-hours" },
  { icon: Settings, label: "Settings", page: "settings" },
  ];

export default function Sidebar({ activePage, onNavigate }) {
    const [collapsed, setCollapsed] = useState(false);

  return (
      <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
              <button
                        className="sidebar__toggle"
                        onClick={() => setCollapsed((c) => !c)}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                      >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            <nav className="sidebar__nav">
                {NAV_ITEMS.map(({ icon: Icon, label, page }) => (
                  <button
                    key={label}
                    className={`sidebar__item ${activePage === page ? "sidebar__item--active" : ""}`}
                    onClick={() => onNavigate(page)}
                    title={label}
                  >
                    <Icon size={18} />
                    {!collapsed && <span>{label}</span>}
                  </button>
                ))}
            </nav>
      </aside>
      );
}

export function MobileNavigation({ activePage, onNavigate, open, onClose }) {
  const navigate = (page) => {
    onNavigate(page);
    onClose();
  };

  return (
    <>
      <button
        className={`mobile-nav__backdrop ${open ? "mobile-nav__backdrop--open" : ""}`}
        type="button"
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside className={`mobile-nav ${open ? "mobile-nav--open" : ""}`} aria-hidden={!open}>
        <div className="mobile-nav__head">
          <div className="mobile-nav__brand">
            <strong>KARIKAALA</strong>
            <span>Management Dashboard</span>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close navigation" tabIndex={open ? 0 : -1}>
            <X size={18} />
          </button>
        </div>
        <nav className="mobile-nav__list" aria-label="Mobile navigation">
          {NAV_ITEMS.map(({ icon: Icon, label, page }) => (
            <button
              key={label}
              type="button"
              className={`mobile-nav__item ${activePage === page ? "mobile-nav__item--active" : ""}`}
              onClick={() => navigate(page)}
              tabIndex={open ? 0 : -1}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
