import {
    LayoutGrid,
    ShoppingCart,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    Users,
    Activity,
    Repeat,
} from "lucide-react";
import { Fragment, useState } from "react";

const NAV_ITEMS = [
    { icon: LayoutGrid, label: "Dashboard", page: "overview" },
  { icon: ShoppingCart, label: "Sales Revenue", page: "sales" },
    { icon: Activity, label: "Weekly Insights", page: "weekly-insights", group: "weekly" },
    { icon: CalendarDays, label: "Weekly Revenue", page: "weekly-performance", group: "weekly" },
    { icon: Users, label: "Weekly Guest count", page: "weekly-guests", group: "weekly" },
    { icon: Repeat, label: "Repeated Guest Analysis", page: "repeated-guests" },
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
                {NAV_ITEMS.map(({ icon: Icon, label, page, group }, idx) => (<Fragment key={label}>
                    {group === "weekly" && (idx === 0 || NAV_ITEMS[idx - 1].group !== "weekly") && !collapsed && <div className="sidebar__section-label">Weekly Performance</div>}
                  
                  <button
                                key={label}
                            className={`sidebar__item ${group === "weekly" ? "sidebar__item--child" : ""} ${activePage === page ? "sidebar__item--active" : ""}`}
                                onClick={() => onNavigate(page)}
                                title={label}
                              >
                    {group === "weekly" && !collapsed ? <span className="sidebar__bullet" /> : <Icon size={18} />}
                    {!collapsed && <span>{label}</span>}
                  </button>
                                                                             </Fragment>
                ))}
            </nav>
      </aside>
      );
}
