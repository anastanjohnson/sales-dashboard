import {
    LayoutGrid,
    ShoppingCart,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    Activity,
    Repeat,
    Clock3,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
    { icon: LayoutGrid, label: "Dashboard", page: "overview" },
  { icon: ShoppingCart, label: "Sales Revenue", page: "sales" },
    { icon: Activity, label: "Weekly Performance", page: "weekly-performance" },
    { icon: Repeat, label: "Repeated Guest Analysis", page: "repeated-guests" },
    { icon: BarChart3, label: "Salary", page: "sales-salary" },
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
