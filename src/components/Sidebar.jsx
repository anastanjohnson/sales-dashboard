import {
    LayoutGrid,
    Euro,
    ChartLine,
    RefreshCcw,
    Banknote,
    Clock3,
    Settings,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
    { icon: LayoutGrid, label: "Dashboard", page: "overview" },
  { icon: Euro, label: "Sales Revenue", page: "sales" },
    { icon: ChartLine, label: "Weekly Performance", page: "weekly-performance" },
    { icon: RefreshCcw, label: "Repeated Guest Analysis", page: "repeated-guests" },
    { icon: Banknote, label: "Salary", page: "sales-salary" },
    { icon: Clock3, label: "Staff Hours", page: "staff-hours" },
  { icon: Settings, label: "Setting", page: "settings" },
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
