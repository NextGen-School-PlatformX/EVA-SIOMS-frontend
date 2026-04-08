"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line
} from "recharts";
import { KPICard } from "@/components/ui";
import { apiClient } from "@/services/apiClient";

const C = ["#0055A5","#00A9CE","#2E7D32","#F57C00","#7B1FA2","#C62828","#00695C","#AD1457"];

// ─── Animated counter hook ────────────────────────────────────────────────────
function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) { setVal(0); return; }
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

// ─── KPI card with animated number ───────────────────────────────────────────
function AnimKPI({ icon, label, value, raw, trend, trendValue, color, bg }: any) {
  const animated = useCountUp(typeof raw === 'number' ? raw : 0);
  const display  = typeof raw === 'number' ? (value.includes('K') ? `EGP ${(animated/1000).toFixed(0)}K` : String(animated)) : value;
  return <KPICard icon={icon} label={label} value={display} trend={trend} trendValue={trendValue} color={color} bg={bg} />;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, prefix = 'EGP ' }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--text)" }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
          <span style={{ color: "var(--text2)" }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: p.color }}>{prefix}{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [stats,      setStats]      = useState<any>(null);
  const [analytics,  setAnalytics]  = useState<any>(null);
  const [revenue,    setRevenue]    = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [activity,   setActivity]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [s, a, r, att, act] = await Promise.all([
        apiClient.get<any>('/dashboard/stats'),
        apiClient.get<any>('/dashboard/analytics'),
        apiClient.get<any[]>('/dashboard/revenue-chart'),
        apiClient.get<any[]>('/dashboard/attendance-chart'),
        apiClient.get<any[]>('/dashboard/recent-activity'),
      ]);
      setStats(s); setAnalytics(a); setRevenue(r); setAttendance(att); setActivity(act);
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleExport = async () => {
    try {
      const blob = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/dashboard/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sioms_token')}` }
      }).then(r => r.blob());
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sioms-dashboard-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch { alert('Export failed'); }
  };

  const donutData = stats ? [
    { name: "Present", value: stats.attendance.present },
    { name: "Late",    value: stats.attendance.late },
    { name: "Absent",  value: stats.attendance.absent },
    { name: "Off",     value: Math.max(0, stats.employees.active - stats.attendance.present - stats.attendance.late - stats.attendance.absent) },
  ].filter(d => d.value > 0) : [];

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16 }}>
      <div style={{ width: 48, height: 48, border: "4px solid var(--border)", borderTop: "4px solid #0055A5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ color: "var(--text3)", fontWeight: 500 }}>Loading dashboard...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div className="fade-in">
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Operations Dashboard</div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchAll(true)} disabled={refreshing}>
            {refreshing ? "⟳ Refreshing..." : "⟳ Refresh"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleExport}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <AnimKPI icon="users"      label="Total Employees"  raw={stats?.employees.total}      value={String(stats?.employees.total ?? 0)}  trend="up"   trendValue={`${stats?.employees.active} active`}          color="#0055A5" bg="rgba(0,85,165,0.1)" />
        <AnimKPI icon="attendance" label="Present Today"    raw={stats?.attendance.present}    value={String(stats?.attendance.present ?? 0)} trend="up" trendValue={`${stats?.attendance.rate}% rate`}             color="#2E7D32" bg="rgba(46,125,50,0.1)" />
        <AnimKPI icon="payroll"    label="Monthly Payroll"  raw={stats?.payroll.monthly}       value={`EGP ${((stats?.payroll.monthly||0)/1000).toFixed(0)}K`} trend="up" trendValue={`${stats?.payroll.pending} pending`} color="#7B1FA2" bg="rgba(123,31,162,0.1)" />
        <AnimKPI icon="inventory"  label="Inventory Value"  raw={stats?.inventory.totalValue}  value={`EGP ${((stats?.inventory.totalValue||0)/1000).toFixed(0)}K`} trend="down" trendValue={`${stats?.inventory.lowStock} low stock`} color="#C62828" bg="rgba(198,40,40,0.1)" />
        <AnimKPI icon="canteen"    label="Canteen Revenue"  raw={stats?.canteen.revenue}       value={`EGP ${((stats?.canteen.revenue||0)/1000).toFixed(0)}K`} trend="up" trendValue="Total sales"                  color="#F57C00" bg="rgba(245,124,0,0.1)" />
        <AnimKPI icon="workshop"   label="Active Equipment" raw={stats?.workshop.active}       value={`${stats?.workshop.active} / ${stats?.workshop.total}`} trend="down" trendValue={`${stats?.workshop.underMaintenance} in maint.`} color="#00695C" bg="rgba(0,105,92,0.1)" />
      </div>

      {/* Row 2: Revenue Area + Attendance Donut */}
      <div className="charts-grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">📈 Revenue Overview (Last 7 Months)</span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>Real data from all modules</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {[["canteen","#0055A5"],["inventory","#00A9CE"],["payroll","#7B1FA2"]].map(([k,c]) => (
                  <linearGradient key={k} id={`grad_${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={c} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={c} stopOpacity={0}    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text3)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text3)" }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="canteen"   stroke="#0055A5" fill="url(#grad_canteen)"   name="Canteen"   strokeWidth={2.5} dot={{ r: 3, fill: "#0055A5" }} activeDot={{ r: 6 }} isAnimationActive animationDuration={1200} animationEasing="ease-out" />
              <Area type="monotone" dataKey="inventory" stroke="#00A9CE" fill="url(#grad_inventory)" name="Purchases" strokeWidth={2.5} dot={{ r: 3, fill: "#00A9CE" }} activeDot={{ r: 6 }} isAnimationActive animationDuration={1400} animationEasing="ease-out" />
              <Area type="monotone" dataKey="payroll"   stroke="#7B1FA2" fill="url(#grad_payroll)"   name="Payroll"   strokeWidth={2.5} dot={{ r: 3, fill: "#7B1FA2" }} activeDot={{ r: 6 }} isAnimationActive animationDuration={1600} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">👥 Today's Attendance</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3}
                dataKey="value" isAnimationActive animationDuration={1000} animationEasing="ease-out">
                {donutData.map((_, i) => <Cell key={i} fill={[C[2],C[3],C[5],C[7]][i]} />)}
              </Pie>
              <Tooltip formatter={(v: number, n: string) => [`${v} employees`, n]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "space-around", padding: "8px 16px" }}>
            {[["Present", stats?.attendance.present, C[2]], ["Late", stats?.attendance.late, C[3]], ["Absent", stats?.attendance.absent, C[5]]].map(([l,v,c]) => (
              <div key={l as string} style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: c as string }}>{v ?? 0}</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Weekly Attendance Bar + Dept headcount */}
      <div className="charts-grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">📅 Weekly Attendance Pattern</span></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendance} barGap={3} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text3)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text3)" }} />
              <Tooltip content={<CustomTooltip prefix="" />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="present" fill="#0055A5" name="Present" radius={[4,4,0,0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
              <Bar dataKey="late"    fill="#F57C00" name="Late"    radius={[4,4,0,0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
              <Bar dataKey="absent"  fill="#C62828" name="Absent"  radius={[4,4,0,0]} isAnimationActive animationDuration={1000} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🏢 Department Headcount</span></div>
          <div style={{ padding: "8px 16px 16px" }}>
            {analytics?.deptHeadcount?.slice(0, 7).map((d: any) => {
              const max = analytics.deptHeadcount[0]?.count || 1;
              return (
                <div key={d.department} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{d.department}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0055A5" }}>{d.count}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(d.count/max)*100}%`, height: "100%",
                      background: "linear-gradient(90deg,#0055A5,#00A9CE)", borderRadius: 4,
                      transition: "width 1s ease-out" }} />
                  </div>
                </div>
              );
            })}
            {!analytics?.deptHeadcount?.length && <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No data yet</div>}
          </div>
        </div>
      </div>

      {/* Row 4: Inventory by Category + Canteen Line */}
      {analytics && (
        <div className="charts-grid" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">📦 Inventory Value by Category</span></div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.invByCategory} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text3)" }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: "var(--text3)" }} />
                <Tooltip formatter={(v: number) => [`EGP ${v.toLocaleString()}`, 'Value']} />
                <Bar dataKey="value" fill="#0055A5" name="Value (EGP)" radius={[0,4,4,0]}
                  isAnimationActive animationDuration={1000} animationEasing="ease-out"
                  label={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">🍽️ Canteen Revenue (Last 14 Days)</span></div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={analytics.canteenDaily} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="canteenLine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F57C00" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#F57C00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text3)" }} tickFormatter={d => d?.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} tickFormatter={v => `${v}`} />
                <Tooltip formatter={(v: number) => [`EGP ${v.toLocaleString()}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#F57C00" strokeWidth={2.5}
                  dot={{ r: 3, fill: "#F57C00" }} activeDot={{ r: 6 }}
                  isAnimationActive animationDuration={1200} animationEasing="ease-out" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Row 5: Quick status cards + Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Status Summary */}
        <div className="card">
          <div className="card-header"><span className="card-title">⚡ System Status</span></div>
          <div style={{ padding: "0 0 16px" }}>
            {[
              { label: "Inventory Low Stock",   val: stats?.inventory.lowStock,          warn: (stats?.inventory.lowStock||0) > 0,          icon: "⚠️", suffix: " items" },
              { label: "Pending Payroll",        val: stats?.payroll.pending,             warn: (stats?.payroll.pending||0) > 0,             icon: "💰", suffix: " records" },
              { label: "Assets In Use",          val: stats?.assets.inUse,               warn: false,                                        icon: "📦", suffix: ` / ${stats?.assets.total}` },
              { label: "Equipment Overdue Maint",val: stats?.workshop.overdue,            warn: (stats?.workshop.overdue||0) > 0,            icon: "🔧", suffix: " units" },
              { label: "Active Suppliers",       val: stats?.suppliers.active,            warn: false,                                        icon: "🤝", suffix: ` / ${stats?.suppliers.total}` },
              { label: "Out of Stock Items",     val: stats?.inventory.outOfStock,        warn: (stats?.inventory.outOfStock||0) > 0,        icon: "🚨", suffix: " items" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 16px", borderBottom: "1px solid var(--border)",
                background: item.warn ? "rgba(198,40,40,0.04)" : undefined }}>
                <span style={{ fontSize: 13 }}>{item.icon} {item.label}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: item.warn ? "#C62828" : "#2E7D32" }}>
                  {item.val ?? 0}{item.suffix}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🕐 Recent Activity</span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>Live from system</span>
          </div>
          <div style={{ overflowY: "auto", maxHeight: 320, padding: "0 0 8px" }}>
            {activity.length === 0 ? (
              <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No activity yet</div>
            ) : activity.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 16, flexShrink: 0,
                  background: `${a.color || "#0055A5"}18` }}>
                  {a.icon || "📌"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.message}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
