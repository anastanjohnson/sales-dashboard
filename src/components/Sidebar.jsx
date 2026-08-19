import {
    LayoutGrid,
    ShoppingCart,
    Receipt,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    Users,
    Activity,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { icon: LayoutGrid, label: "Dashboard", page: "overview" },
  { icon: ShoppingCart, label: "Sales Revenue", page: "sales" },
  { icon: CalendarDays, label: "Weekly Performance", page: "weekly-performance" },
  { icon: Users, label: "Guest Count", page: "weekly-guests" },
  { icon: Activity, label: "Weekly Insights", page: "weekly-insights" },
  { icon: Receipt, label: "Average Spending", page: "average-spending" },
  { icon: BarChart3, label: "Salary", page: "sales-salary" },
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
