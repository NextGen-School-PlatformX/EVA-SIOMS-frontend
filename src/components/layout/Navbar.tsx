"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import type { PageId, User } from "@/types";
import { NAV_ITEMS } from "./Sidebar";
import { apiClient } from "@/services/apiClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Notification { text: string; time: string; unread: boolean; type: string; }
interface NavbarProps {
  page: PageId; collapsed: boolean; toggleCollapsed: () => void;
  dark: boolean; toggleDark: () => void;
  user: User; onLogout: () => void; onNavigate: (page: PageId) => void;
}

// ─── Avatar component — shows photo or initials ────────────────────────────
export function UserAvatar({ user, size = 32 }: { user: User; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const src = user.profileImage && !imgError
    ? (user.profileImage.startsWith('http') ? user.profileImage : `${API_BASE}${user.profileImage}`)
    : null;

  if (src) {
    return (
      <img src={src} alt={user.name} onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block", flexShrink: 0 }} />
    );
  }
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4),
      background: "linear-gradient(135deg,#0055A5,#00A9CE)", flexShrink: 0 }}>
      {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
    </div>
  );
}

export const Navbar = ({ page, collapsed, toggleCollapsed, dark, toggleDark, user, onLogout, onNavigate }: NavbarProps) => {
  const [showNotif,   setShowNotif]   = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifRead,   setNotifRead]   = useState(false);
  const notifRef   = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      const notifs: Notification[] = [];
      try {
        const inv = await apiClient.get<any>('/inventory/summary');
        if (inv.lowStock > 0) notifs.push({ text: `⚠️ ${inv.lowStock} items below minimum stock`, time: 'now', unread: true, type: 'inventory' });
      } catch {}
      try {
        const leaves = await apiClient.get<any[]>('/hr/leaves');
        const pending = leaves.filter((l: any) => l.status === 'Pending');
        if (pending.length > 0) notifs.push({ text: `📋 ${pending.length} leave request${pending.length > 1 ? 's' : ''} pending`, time: 'now', unread: true, type: 'hr' });
      } catch {}
      try {
        const ws = await apiClient.get<any>('/workshop/equipment/summary');
        if (ws.overdueMaint > 0) notifs.push({ text: `🔧 ${ws.overdueMaint} equipment overdue for maintenance`, time: 'today', unread: true, type: 'workshop' });
        else if (ws.dueSoon > 0) notifs.push({ text: `🔔 ${ws.dueSoon} equipment maintenance due this week`, time: 'today', unread: false, type: 'workshop' });
      } catch {}
      try {
        const pay = await apiClient.get<any>('/payroll/summary');
        if (pay.pending > 0) notifs.push({ text: `💰 ${pay.pending} payroll records pending`, time: 'today', unread: false, type: 'payroll' });
      } catch {}
      if (notifs.length === 0) notifs.push({ text: '✅ All systems operational', time: 'now', unread: false, type: 'system' });
      setNotifications(notifs);
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount  = notifications.filter(n => n.unread && !notifRead).length;
  const currentNav   = NAV_ITEMS.find(n => n.id === page);

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="icon-btn" onClick={toggleCollapsed}>
          <Icon name={collapsed ? "chevronRight" : "menu"} size={18} />
        </button>
        <div>
          <div className="page-title">{currentNav?.label || "Dashboard"}</div>
          <div className="breadcrumb">
            SIOMS
            <Icon name="chevronRight" size={10} style={{ color: "var(--text3)" }} />
            {currentNav?.group}
            <Icon name="chevronRight" size={10} style={{ color: "var(--text3)" }} />
            {currentNav?.label}
          </div>
        </div>
      </div>

      <div className="navbar-right">
        <button className="icon-btn" onClick={toggleDark} title={dark ? "Light mode" : "Dark mode"}>
          <Icon name={dark ? "sun" : "moon"} size={18} />
        </button>

        {/* Notifications */}
        <div className="dropdown" ref={notifRef}>
          <button className="icon-btn" onClick={() => { setShowNotif(n => !n); setShowProfile(false); setNotifRead(true); }}>
            <Icon name="bell" size={18} />
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>
          {showNotif && (
            <div className="dropdown-menu" style={{ width: 360 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 14, display: "flex", justifyContent: "space-between" }}>
                <span>Notifications</span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>Live · {notifications.length} alerts</span>
              </div>
              {notifications.map((n, i) => (
                <div key={i} className={`notif-item ${n.unread && !notifRead ? "unread" : ""}`} onClick={() => setShowNotif(false)}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    {n.unread && !notifRead && <div className="notif-dot" style={{ marginTop: 5 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{n.text}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{n.time}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profile chip — shows photo or initials */}
        <div className="dropdown" ref={profileRef}>
          <div className="profile-chip" onClick={() => { setShowProfile(p => !p); setShowNotif(false); }}>
            <UserAvatar user={user} size={30} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{user.name}</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>{user.role}</div>
            </div>
            <Icon name="chevronDown" size={14} style={{ color: "var(--text3)" }} />
          </div>
          {showProfile && (
            <div className="dropdown-menu">
              {/* Mini profile header with photo */}
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "center" }}>
                <UserAvatar user={user} size={44} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{user.email}</div>
                  <div style={{ fontSize: 11, marginTop: 2, padding: "1px 6px", background: "rgba(0,85,165,0.1)", color: "#0055A5", borderRadius: 6, display: "inline-block", fontWeight: 600 }}>{user.role}</div>
                </div>
              </div>
              <button className="dropdown-item" onClick={() => { setShowProfile(false); onNavigate('settings'); }}>
                <Icon name="users" size={16} />My Profile
              </button>
              <button className="dropdown-item" onClick={() => { setShowProfile(false); onNavigate('settings'); }}>
                <Icon name="edit" size={16} />Settings
              </button>
              <div className="dropdown-divider" />
              <button className="dropdown-item" style={{ color: "var(--danger)" }} onClick={onLogout}>
                <Icon name="logout" size={16} />Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
