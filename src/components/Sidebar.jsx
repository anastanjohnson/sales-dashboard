import {
    LayoutGrid,
    ShoppingCart,
    UtensilsCrossed,
    BookOpen,
    Users,
    Receipt,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    CalendarDays,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { icon: LayoutGrid, label: "Overview", page: "overview" },
  { icon: ShoppingCart, label: "Sales", page: "sales" },
  { icon: CalendarDays, label: "Weekly Performance", page: "weekly-performance", child: true },
  { icon: Receipt, label: "Orders" },
  { icon: UtensilsCrossed, label: "Menu" },
  { icon: BookOpen, label: "Reservations" },
  { icon: Users, label: "Staff" },
  { icon: ShoppingCart, label: "Billing" },
  { icon: BarChart3, label: "Salary", page: "sales-salary" },
  { icon: Settings, label: "Settings" },
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
              {NAV_ITEMS.map(({ icon: Icon, label, page, child }) => (
                  <button
                                key={label}
                                className={`sidebar__item ${child ? "sidebar__item--child" : ""} ${page && activePage === page ? "sidebar__item--active" : ""}`}
                                onClick={() => page && onNavigate(page)}
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
