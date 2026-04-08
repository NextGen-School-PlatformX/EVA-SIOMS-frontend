"use client";

import React from "react";
import { Icon } from "./Icon";

// ── Badge ──────────────────────────────────────
export const Badge = ({ status }: { status: string }) => {
  const cls = status?.toLowerCase().replace(/\s+/g, "-") || "active";
  return <span className={`badge-status badge-${cls}`}>{status}</span>;
};

// ── SearchBar ──────────────────────────────────
interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}
export const SearchBar = ({ value, onChange, placeholder = "Search..." }: SearchBarProps) => (
  <div className="search-bar">
    <Icon name="search" size={16} style={{ color: "var(--text3)", flexShrink: 0 }} />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

// ── Pagination ─────────────────────────────────
interface PaginationProps {
  total: number;
  perPage: number;
  page: number;
  setPage: (p: number) => void;
}
export const Pagination = ({ total, perPage, page, setPage }: PaginationProps) => {
  const pages = Math.ceil(total / perPage);
  return (
    <div className="pagination">
      <button className="page-btn" onClick={() => setPage(Math.max(1, page - 1))}>‹</button>
      {Array.from({ length: Math.min(5, pages) }, (_, i) => {
        const p = i + 1;
        return (
          <button key={p} className={`page-btn ${page === p ? "active" : ""}`} onClick={() => setPage(p)}>
            {p}
          </button>
        );
      })}
      {pages > 5 && <span style={{ padding: "0 4px", color: "var(--text3)" }}>...</span>}
      <button className="page-btn" onClick={() => setPage(Math.min(pages, page + 1))}>›</button>
      <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 8 }}>{total} records</span>
    </div>
  );
};

// ── Modal ──────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
}
export const Modal = ({ open, onClose, title, children, footer, width }: ModalProps) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in" style={width ? { maxWidth: width, width: '90%' } : {}}>
        <div className="modal-header">
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} style={{ border: "none" }}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

// ── KPICard ────────────────────────────────────
interface KPICardProps {
  icon: string;
  label: string;
  value: string | number;
  trend?: "up" | "down";
  trendValue?: string;
  color?: string;
  bg?: string;
}
export const KPICard = ({
  icon, label, value, trend, trendValue,
  color = "var(--primary)",
  bg = "rgba(0,85,165,0.1)",
}: KPICardProps) => (
  <div className="kpi-card">
    <div className="kpi-icon" style={{ background: bg }}>
      <Icon name={icon} size={20} style={{ color }} />
    </div>
    <div className="kpi-value">{value}</div>
    <div className="kpi-label">{label}</div>
    {trend && (
      <div className={`kpi-trend ${trend === "up" ? "trend-up" : "trend-down"}`}>
        <Icon name="trend" size={12} />
        {trendValue}
      </div>
    )}
  </div>
);

// ── Tabs ───────────────────────────────────────
interface TabsProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}
export const Tabs = ({ tabs, active, onChange }: TabsProps) => (
  <div className="tabs">
    {tabs.map((t) => (
      <button key={t.id} className={`tab ${active === t.id ? "active" : ""}`} onClick={() => onChange(t.id)}>
        {t.label}
      </button>
    ))}
  </div>
);
