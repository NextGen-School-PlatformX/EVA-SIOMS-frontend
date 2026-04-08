"use client";

import { Icon } from "@/components/ui/Icon";
import type { NavItem, PageId, User } from "@/types";
import { authService } from "@/services/authService";

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", group: "Overview" },
  { id: "attendance", label: "Attendance", icon: "attendance", group: "Operations" },
  { id: "hr", label: "Human Resources", icon: "hr", group: "Operations" },
  { id: "payroll", label: "Payroll", icon: "payroll", group: "Operations" },
  { id: "canteen", label: "Canteen", icon: "canteen", group: "Services" },
  { id: "inventory", label: "Inventory", icon: "inventory", group: "Services" },
  { id: "suppliers", label: "Suppliers", icon: "suppliers", group: "Services" },
  { id: "workshop", label: "Workshop", icon: "workshop", group: "Facilities" },
  { id: "assets", label: "Assets Custody", icon: "assets", group: "Facilities" },
  { id: "settings", label: "Settings", icon: "edit", group: "System" },
];

const GROUPS = ["Overview", "Operations", "Services", "Facilities", "System"];

interface SidebarProps {
  page: PageId;
  setPage: (id: PageId) => void;
  collapsed: boolean;
  onLogout: () => void;
  user: User | null;
}

export const Sidebar = ({ page, setPage, collapsed, onLogout, user }: SidebarProps) => {
  const filteredNavItems = NAV_ITEMS.filter(item => authService.hasPermission(user, item.id));
  const activeGroups = GROUPS.filter(group => filteredNavItems.some(item => item.group === group));

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Icon name="workshop" size={20} style={{ color: "white" }} />
        </div>
        <div className="sidebar-logo-text">
          SIOMS
          <div className="sidebar-logo-sub">School Operations</div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {activeGroups.map((group) => (
          <div key={group} className="nav-section">
            <div className="nav-section-label">{group}</div>
            {filteredNavItems.filter((n) => n.group === group).map((item) => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => setPage(item.id)}
                title={item.label}
              >
                <Icon name={item.icon} size={20} />
                <span className="nav-item-text">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="nav-item" onClick={onLogout} title="Logout">
          <Icon name="logout" size={20} />
          <span className="nav-item-text">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export { NAV_ITEMS };
