"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { KPICard, Badge, Modal } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { Icon } from "@/components/ui/Icon";
import { apiClient } from "@/services/apiClient";

const MAINT_TYPES = ["Preventive", "Corrective", "Major Overhaul", "Inspection"];
const CONDITIONS  = ["Excellent", "Good", "Fair", "Poor"];
const EQ_STATUSES = ["Active", "Under Maintenance", "Out of Service"];
const DEPARTMENTS = ["General", "Electronics", "Mechanics", "Welding", "Woodworking", "Plumbing", "IT"];

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  "Preventive":    { bg: "rgba(46,125,50,0.12)",    color: "#2E7D32" },
  "Corrective":    { bg: "rgba(198,40,40,0.12)",     color: "#C62828" },
  "Major Overhaul":{ bg: "rgba(69,39,160,0.12)",     color: "#4527A0" },
  "Inspection":    { bg: "rgba(21,101,192,0.12)",    color: "#1565C0" },
};

const STATUS_COLOR: Record<string, string> = {
  "Active": "#2E7D32", "Under Maintenance": "#F57C00", "Out of Service": "#C62828",
};

export default function Workshop() {
  const toast = useToast();
  const [tab, setTab] = useState<"workshops"|"equipment"|"maintenance"|"analytics">("workshops");

  // Workshops
  const [workshops, setWorkshops]       = useState<any[]>([]);
  const [showWsModal, setShowWsModal]   = useState(false);
  const [editWs, setEditWs]             = useState<any>(null);
  const wsNameRef     = useRef<HTMLInputElement>(null);
  const wsLocationRef = useRef<HTMLInputElement>(null);
  const wsStatusRef   = useRef<HTMLSelectElement>(null);

  // Equipment
  const [equipment, setEquipment]       = useState<any[]>([]);
  const [eqSearch, setEqSearch]         = useState("");
  const [eqWsFilter, setEqWsFilter]     = useState("");
  const [eqStatusFilter, setEqStatusFilter] = useState("");
  const [summary, setSummary]           = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [showEqModal, setShowEqModal]   = useState(false);
  const [editEq, setEditEq]             = useState<any>(null);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintTarget, setMaintTarget]   = useState<any>(null);
  const [eqHistoryModal, setEqHistoryModal] = useState(false);
  const [eqHistory, setEqHistory]       = useState<any[]>([]);
  const [historyEq, setHistoryEq]       = useState<any>(null);

  const eqNameRef    = useRef<HTMLInputElement>(null);
  const eqSerialRef  = useRef<HTMLInputElement>(null);
  const eqModelRef   = useRef<HTMLInputElement>(null);
  const eqWsRef      = useRef<HTMLSelectElement>(null);
  const eqDeptRef    = useRef<HTMLSelectElement>(null);
  const eqStatusRef  = useRef<HTMLSelectElement>(null);
  const eqCondRef    = useRef<HTMLSelectElement>(null);
  const eqNextRef    = useRef<HTMLInputElement>(null);
  const eqNotesRef   = useRef<HTMLTextAreaElement>(null);

  // Maintenance log form
  const [maintType, setMaintType]       = useState("Preventive");
  const maintTechRef  = useRef<HTMLInputElement>(null);
  const maintNotesRef = useRef<HTMLTextAreaElement>(null);
  const maintCostRef  = useRef<HTMLInputElement>(null);
  const maintNextRef  = useRef<HTMLInputElement>(null);
  const [maintStatus, setMaintStatus]   = useState("Active");

  // Maintenance logs tab
  const [logs, setLogs]                 = useState<any[]>([]);
  const [logTypeFilter, setLogTypeFilter] = useState("All");
  const [logsLoading, setLogsLoading]   = useState(false);

  // Analytics
  const [analytics, setAnalytics]       = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Fetches ──────────────────────────────────────────────────────────────────

  const fetchWorkshops = useCallback(async () => {
    try { setWorkshops(await apiClient.get<any[]>('/workshop/workshops')); }
    catch { toast("Failed to load workshops", "error"); }
  }, []);

  const fetchEquipment = useCallback(async () => {
    setLoading(true);
    try {
      const [eq, sum] = await Promise.all([
        apiClient.get<any[]>(`/workshop/equipment?search=${eqSearch}&workshopId=${eqWsFilter}&status=${eqStatusFilter}`),
        apiClient.get<any>('/workshop/equipment/summary'),
      ]);
      setEquipment(eq); setSummary(sum);
    } catch { toast("Failed to load equipment", "error"); }
    finally { setLoading(false); }
  }, [eqSearch, eqWsFilter, eqStatusFilter]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try { setLogs(await apiClient.get<any[]>(`/workshop/maintenance?type=${logTypeFilter}`)); }
    catch { toast("Failed to load logs", "error"); }
    finally { setLogsLoading(false); }
  }, [logTypeFilter]);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try { setAnalytics(await apiClient.get<any>('/workshop/analytics')); }
    catch { toast("Failed to load analytics", "error"); }
    finally { setAnalyticsLoading(false); }
  };

  useEffect(() => { fetchWorkshops(); }, [fetchWorkshops]);
  useEffect(() => { if (tab === "equipment" || tab === "workshops") fetchEquipment(); }, [tab, fetchEquipment]);
  useEffect(() => { if (tab === "maintenance") fetchLogs(); }, [tab, fetchLogs]);
  useEffect(() => { if (tab === "analytics") fetchAnalytics(); }, [tab]);

  // ── Workshop Handlers ─────────────────────────────────────────────────────────

  const openWsModal = (ws?: any) => {
    setEditWs(ws || null);
    setShowWsModal(true);
    setTimeout(() => {
      if (wsNameRef.current)     wsNameRef.current.value     = ws?.name || "";
      if (wsLocationRef.current) wsLocationRef.current.value = ws?.location || "";
      if (wsStatusRef.current)   wsStatusRef.current.value   = ws?.status || "Active";
    }, 50);
  };

  const handleSaveWorkshop = async () => {
    const name = wsNameRef.current?.value?.trim();
    if (!name) { toast("Workshop name is required", "error"); return; }
    try {
      const body = { name, location: wsLocationRef.current?.value, status: wsStatusRef.current?.value };
      if (editWs) { await apiClient.put(`/workshop/workshops/${editWs.id}`, body); toast("Workshop updated", "success"); }
      else        { await apiClient.post('/workshop/workshops', body); toast("Workshop created", "success"); }
      setShowWsModal(false); setEditWs(null); fetchWorkshops(); fetchEquipment();
    } catch (e: any) { toast(e.message || "Failed", "error"); }
  };

  const handleDeleteWorkshop = async (ws: any) => {
    if (!confirm(`Delete workshop "${ws.name}"?`)) return;
    try { await apiClient.delete(`/workshop/workshops/${ws.id}`); toast("Deleted", "success"); fetchWorkshops(); }
    catch { toast("Failed to delete", "error"); }
  };

  // ── Equipment Handlers ────────────────────────────────────────────────────────

  const openEqModal = (eq?: any) => {
    setEditEq(eq || null);
    setShowEqModal(true);
    setTimeout(() => {
      if (eqNameRef.current)   eqNameRef.current.value   = eq?.name    || "";
      if (eqSerialRef.current) eqSerialRef.current.value = eq?.serial  || "";
      if (eqModelRef.current)  eqModelRef.current.value  = eq?.model   || "";
      if (eqWsRef.current)     eqWsRef.current.value     = eq?.workshopId?.toString() || "";
      if (eqDeptRef.current)   eqDeptRef.current.value   = eq?.department || "General";
      if (eqStatusRef.current) eqStatusRef.current.value = eq?.status  || "Active";
      if (eqCondRef.current)   eqCondRef.current.value   = eq?.condition || "Good";
      if (eqNextRef.current)   eqNextRef.current.value   = eq?.nextMaintenance || "";
      if (eqNotesRef.current)  eqNotesRef.current.value  = eq?.notes   || "";
    }, 50);
  };

  const handleSaveEquipment = async () => {
    const name = eqNameRef.current?.value?.trim();
    if (!name) { toast("Equipment name is required", "error"); return; }
    const body = {
      workshopId: eqWsRef.current?.value || null,
      name, serial: eqSerialRef.current?.value,
      model: eqModelRef.current?.value,
      department: eqDeptRef.current?.value || "General",
      status: eqStatusRef.current?.value || "Active",
      condition: eqCondRef.current?.value || "Good",
      nextMaintenance: eqNextRef.current?.value || "",
      notes: eqNotesRef.current?.value || "",
    };
    try {
      if (editEq) { await apiClient.put(`/workshop/equipment/${editEq.id}`, body); toast("Updated", "success"); }
      else        { await apiClient.post('/workshop/equipment', body); toast("Equipment added", "success"); }
      setShowEqModal(false); setEditEq(null); fetchEquipment();
    } catch (e: any) { toast(e.message || "Failed", "error"); }
  };

  const handleDeleteEquipment = async (eq: any) => {
    if (!confirm(`Delete "${eq.name}"?`)) return;
    try { await apiClient.delete(`/workshop/equipment/${eq.id}`); toast("Deleted", "success"); fetchEquipment(); }
    catch { toast("Failed to delete", "error"); }
  };

  const openMaintModal = (eq: any) => {
    setMaintTarget(eq);
    setMaintType("Preventive");
    setMaintStatus("Active");
    setShowMaintModal(true);
    setTimeout(() => {
      if (maintTechRef.current)  maintTechRef.current.value  = "";
      if (maintNotesRef.current) maintNotesRef.current.value = "";
      if (maintCostRef.current)  maintCostRef.current.value  = "0";
      if (maintNextRef.current)  maintNextRef.current.value  = "";
    }, 50);
  };

  const handleLogMaintenance = async () => {
    if (!maintTarget) return;
    const technician = maintTechRef.current?.value?.trim();
    if (!technician) { toast("Technician name is required", "error"); return; }
    try {
      await apiClient.post('/workshop/maintenance', {
        equipmentId: maintTarget.id,
        type: maintType,
        technician,
        notes: maintNotesRef.current?.value || "",
        cost: parseFloat(maintCostRef.current?.value || "0") || 0,
        nextDate: maintNextRef.current?.value || "",
        updateStatus: maintStatus,
      });
      toast("Maintenance logged successfully", "success");
      setShowMaintModal(false); setMaintTarget(null);
      fetchEquipment();
      if (tab === "maintenance") fetchLogs();
    } catch (e: any) { toast(e.message || "Failed", "error"); }
  };

  const openHistory = async (eq: any) => {
    setHistoryEq(eq);
    setEqHistoryModal(true);
    try { setEqHistory(await apiClient.get<any[]>(`/workshop/equipment/${eq.id}/maintenance`)); }
    catch { toast("Failed to load history", "error"); }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const TABS = [
    { id: "workshops",   label: "🏭 Workshops"   },
    { id: "equipment",   label: "⚙️ Equipment"    },
    { id: "maintenance", label: "🔧 Maintenance"  },
    { id: "analytics",  label: "📊 Analytics"    },
  ];

  return (
    <div className="fade-in">
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding: "10px 22px", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer",
            borderBottom: tab === t.id ? "3px solid #0055A5" : "3px solid transparent",
            color: tab === t.id ? "#0055A5" : "var(--text2)",
            background: "transparent", marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      {/* KPI Strip */}
      {(tab === "workshops" || tab === "equipment") && (
        <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 20 }}>
          <KPICard icon="workshop" label="Total Equipment" value={summary?.total ?? "—"}            color="#0055A5" bg="rgba(0,85,165,0.1)"   />
          <KPICard icon="check"   label="Active"          value={summary?.active ?? "—"}            color="#2E7D32" bg="rgba(46,125,50,0.1)"  />
          <KPICard icon="alert"   label="Under Maint."    value={summary?.underMaintenance ?? "—"}  color="#F57C00" bg="rgba(245,124,0,0.1)"  />
          <KPICard icon="close"   label="Overdue"         value={summary?.overdueMaint ?? "—"}      color="#C62828" bg="rgba(198,40,40,0.1)"  />
          <KPICard icon="trend"   label="Due in 7 Days"   value={summary?.dueSoon ?? "—"}           color="#7B1FA2" bg="rgba(123,31,162,0.1)" />
        </div>
      )}

      {/* ══════════════ WORKSHOPS TAB ══════════════ */}
      {tab === "workshops" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Workshop Registry ({workshops.length})</span>
            <button className="btn btn-primary btn-sm" onClick={() => openWsModal()}>
              <Icon name="plus" size={14} />New Workshop
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16, padding: 20 }}>
            {workshops.map(ws => (
              <div key={ws.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, position: "relative", borderTop: `4px solid ${STATUS_COLOR[ws.status] || "#0055A5"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{ws.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>📍 {ws.location || "No location"}</div>
                  </div>
                  <Badge status={ws.status} />
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 16, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#0055A5" }}>{ws.total}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>Total</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#2E7D32" }}>{ws.active}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>Active</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#F57C00" }}>{ws.underMaintenance}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>In Maint.</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-xs btn-secondary" style={{ flex: 1 }} onClick={() => { setEqWsFilter(ws.id.toString()); setTab("equipment"); }}>
                    View Equipment
                  </button>
                  <button className="btn btn-xs btn-secondary" onClick={() => openWsModal(ws)}><Icon name="edit" size={12} /></button>
                  <button className="btn btn-xs btn-danger" onClick={() => handleDeleteWorkshop(ws)}><Icon name="trash" size={12} /></button>
                </div>
              </div>
            ))}
            {workshops.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "var(--text3)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏭</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>No workshops yet</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Create your first workshop to start tracking equipment</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ EQUIPMENT TAB ══════════════ */}
      {tab === "equipment" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Equipment Registry ({equipment.length})</span>
            <button className="btn btn-primary btn-sm" onClick={() => openEqModal()}>
              <Icon name="plus" size={14} />Add Equipment
            </button>
          </div>
          <div className="filter-bar" style={{ padding: 15, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input className="form-input" style={{ width: 220 }} placeholder="Search name, serial, model..."
              value={eqSearch} onChange={e => setEqSearch(e.target.value)} />
            <select className="form-input" style={{ width: 180 }} value={eqWsFilter} onChange={e => setEqWsFilter(e.target.value)}>
              <option value="">All Workshops</option>
              {workshops.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select className="form-input" style={{ width: 160 }} value={eqStatusFilter} onChange={e => setEqStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {EQ_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Loading...</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Equipment</th><th>Workshop</th><th>Department</th>
                    <th>Status</th><th>Condition</th>
                    <th>Last Maint.</th><th>Next Due</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map(eq => {
                    const isOverdue  = eq.nextMaintenance && new Date(eq.nextMaintenance) < new Date();
                    const isDueSoon  = eq.nextMaintenance && !isOverdue && new Date(eq.nextMaintenance) <= new Date(Date.now() + 7 * 86400000);
                    return (
                      <tr key={eq.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{eq.name}</div>
                          {eq.serial && <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)" }}>S/N: {eq.serial}</div>}
                          {eq.model  && <div style={{ fontSize: 11, color: "var(--text3)" }}>{eq.model}</div>}
                        </td>
                        <td style={{ fontSize: 13 }}>{eq.workshopName || <span style={{ color: "var(--text3)" }}>—</span>}</td>
                        <td>{eq.department}</td>
                        <td><Badge status={eq.status} /></td>
                        <td><Badge status={eq.condition} /></td>
                        <td style={{ fontSize: 12, color: "var(--text3)" }}>{eq.lastMaintenance || "—"}</td>
                        <td>
                          {eq.nextMaintenance ? (
                            <span style={{ fontSize: 12, fontWeight: isOverdue ? 700 : 400, color: isOverdue ? "#C62828" : isDueSoon ? "#F57C00" : "var(--text2)" }}>
                              {isOverdue && "⚠️ "}{isDueSoon && "🔔 "}{eq.nextMaintenance}
                            </span>
                          ) : <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-xs" style={{ background: "rgba(46,125,50,0.1)", color: "#2E7D32", border: "1px solid rgba(46,125,50,0.2)" }}
                              onClick={() => openMaintModal(eq)} title="Log Maintenance">
                              🔧
                            </button>
                            <button className="btn btn-xs btn-secondary" onClick={() => openHistory(eq)} title="History">📋</button>
                            <button className="btn btn-xs btn-secondary" onClick={() => openEqModal(eq)}><Icon name="edit" size={12} /></button>
                            <button className="btn btn-xs btn-danger" onClick={() => handleDeleteEquipment(eq)}><Icon name="trash" size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {equipment.length === 0 && !loading && (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>No equipment found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ MAINTENANCE TAB ══════════════ */}
      {tab === "maintenance" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Maintenance History ({logs.length})</span>
          </div>
          <div className="filter-bar" style={{ padding: 15, display: "flex", gap: 8 }}>
            {["All", ...MAINT_TYPES].map(t => (
              <button key={t} className={`btn btn-xs ${logTypeFilter === t ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setLogTypeFilter(t)}>{t}</button>
            ))}
          </div>
          {logsLoading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Loading...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Equipment</th><th>Type</th><th>Date</th><th>Technician</th><th>Cost</th><th>Notes</th><th>Next Due</th></tr></thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.equipment_name}</td>
                      <td>
                        <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                          background: TYPE_STYLE[l.type]?.bg || "var(--surface2)",
                          color: TYPE_STYLE[l.type]?.color || "var(--text)" }}>
                          {l.type}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{l.date}</td>
                      <td style={{ fontWeight: 500 }}>{l.technician || "—"}</td>
                      <td style={{ fontWeight: 600, color: "#0055A5" }}>
                        {l.cost > 0 ? `EGP ${Number(l.cost).toLocaleString()}` : "—"}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text2)", maxWidth: 250 }}>{l.notes || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text3)" }}>{l.next_date || "—"}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>No maintenance logs yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ANALYTICS TAB ══════════════ */}
      {tab === "analytics" && (
        <div className="fade-in">
          {analyticsLoading ? <div style={{ padding: 60, textAlign: "center", color: "var(--text3)" }}>Loading analytics...</div> : analytics && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                {/* Status Breakdown */}
                <div className="card">
                  <div className="card-header"><span className="card-title">Equipment Status</span></div>
                  <div style={{ padding: "0 0 16px" }}>
                    {analytics.statusBreakdown?.map((s: any) => (
                      <div key={s.status} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 16px", margin: "4px 0",
                        background: s.status === "Active" ? "rgba(46,125,50,0.08)" : s.status === "Under Maintenance" ? "rgba(245,124,0,0.08)" : "rgba(198,40,40,0.08)",
                        borderRadius: 8 }}>
                        <span style={{ fontWeight: 600, color: STATUS_COLOR[s.status] || "var(--text)" }}>{s.status}</span>
                        <span style={{ fontSize: 24, fontWeight: 800 }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Maintenance Cost by Type */}
                <div className="card">
                  <div className="card-header"><span className="card-title">Maintenance Cost by Type</span></div>
                  <div style={{ padding: "10px 16px 16px" }}>
                    {analytics.maintenanceCostByType?.map((t: any) => {
                      const max = Math.max(...(analytics.maintenanceCostByType?.map((x: any) => x.totalCost || 0) || [1]), 1);
                      return (
                        <div key={t.type} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: TYPE_STYLE[t.type]?.color || "var(--text)" }}>{t.type}</span>
                            <span style={{ fontSize: 12 }}>EGP {Number(t.totalCost || 0).toLocaleString()} · {t.count} jobs</span>
                          </div>
                          <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${((t.totalCost || 0) / max) * 100}%`, height: "100%",
                              background: TYPE_STYLE[t.type]?.color || "#0055A5", borderRadius: 4 }} />
                          </div>
                        </div>
                      );
                    })}
                    {(!analytics.maintenanceCostByType || analytics.maintenanceCostByType.length === 0) && (
                      <div style={{ padding: 20, textAlign: "center", color: "var(--text3)" }}>No maintenance data yet</div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                {/* Upcoming Maintenance */}
                <div className="card">
                  <div className="card-header"><span className="card-title">🔔 Upcoming Maintenance</span></div>
                  <div className="table-wrap" style={{ maxHeight: 280, overflowY: "auto" }}>
                    <table>
                      <thead><tr><th>Equipment</th><th>Due Date</th><th>Status</th></tr></thead>
                      <tbody>
                        {analytics.upcomingMaintenance?.map((u: any, i: number) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 500 }}>{u.name}</td>
                            <td style={{ fontSize: 12, color: "#F57C00", fontWeight: 600 }}>{u.next_maintenance}</td>
                            <td><Badge status={u.status} /></td>
                          </tr>
                        ))}
                        {(!analytics.upcomingMaintenance?.length) && <tr><td colSpan={3} style={{ textAlign: "center", padding: 20, color: "var(--text3)" }}>No upcoming maintenance 🎉</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Overdue */}
                <div className="card">
                  <div className="card-header"><span className="card-title">⚠️ Overdue Maintenance</span></div>
                  <div className="table-wrap" style={{ maxHeight: 280, overflowY: "auto" }}>
                    <table>
                      <thead><tr><th>Equipment</th><th>Was Due</th><th>Status</th></tr></thead>
                      <tbody>
                        {analytics.overdue?.map((o: any, i: number) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 500 }}>{o.name}</td>
                            <td style={{ fontSize: 12, color: "#C62828", fontWeight: 700 }}>{o.next_maintenance}</td>
                            <td><Badge status={o.status} /></td>
                          </tr>
                        ))}
                        {(!analytics.overdue?.length) && <tr><td colSpan={3} style={{ textAlign: "center", padding: 20, color: "var(--text3)" }}>No overdue items 🎉</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Monthly Cost Chart */}
              {analytics.monthlyMaintenanceCost?.length > 0 && (
                <div className="card">
                  <div className="card-header"><span className="card-title">📈 Monthly Maintenance Cost (EGP)</span></div>
                  <div style={{ padding: "20px 20px 10px", display: "flex", gap: 10, alignItems: "flex-end", height: 220 }}>
                    {analytics.monthlyMaintenanceCost.map((m: any) => {
                      const max = Math.max(...analytics.monthlyMaintenanceCost.map((x: any) => x.totalCost || 0), 1);
                      const h = Math.max(((m.totalCost || 0) / max) * 160, 4);
                      return (
                        <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#0055A5" }}>{m.totalCost > 0 ? Math.round(m.totalCost) : ""}</span>
                          <div style={{ width: "100%", maxWidth: 36, height: h, background: "linear-gradient(180deg,#0055A5,#00A9CE)", borderRadius: "4px 4px 0 0" }} />
                          <span style={{ fontSize: 10, color: "var(--text3)" }}>{m.month?.split("-")[1]}/{m.month?.split("-")[0].slice(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* By Workshop */}
              {analytics.byWorkshop?.length > 0 && (
                <div className="card" style={{ marginTop: 20 }}>
                  <div className="card-header"><span className="card-title">Equipment by Workshop</span></div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Workshop</th><th>Total Equipment</th><th>Active</th><th>Under Maintenance</th></tr></thead>
                      <tbody>
                        {analytics.byWorkshop.map((w: any, i: number) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{w.name}</td>
                            <td style={{ fontWeight: 700 }}>{w.total}</td>
                            <td style={{ color: "#2E7D32", fontWeight: 600 }}>{w.active}</td>
                            <td style={{ color: "#F57C00", fontWeight: 600 }}>{w.maintenance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════ WORKSHOP MODAL ══════ */}
      <Modal open={showWsModal} onClose={() => { setShowWsModal(false); setEditWs(null); }}
        title={editWs ? `Edit Workshop — ${editWs.name}` : "New Workshop"}
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowWsModal(false); setEditWs(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveWorkshop}>{editWs ? "Save Changes" : "Create Workshop"}</button>
        </>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group"><label className="form-label">Workshop Name *</label>
            <input ref={wsNameRef} className="form-input" placeholder="e.g., Welding Workshop A" />
          </div>
          <div className="form-group"><label className="form-label">Location</label>
            <input ref={wsLocationRef} className="form-input" placeholder="e.g., Building 3, Floor 1" />
          </div>
          <div className="form-group"><label className="form-label">Status</label>
            <select ref={wsStatusRef} className="form-input">
              <option>Active</option><option>Under Maintenance</option><option>Out of Service</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* ══════ EQUIPMENT MODAL ══════ */}
      <Modal open={showEqModal} onClose={() => { setShowEqModal(false); setEditEq(null); }}
        title={editEq ? `Edit — ${editEq.name}` : "Add New Equipment"} width={600}
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowEqModal(false); setEditEq(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveEquipment}>{editEq ? "Save Changes" : "Add Equipment"}</button>
        </>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group"><label className="form-label">Equipment Name *</label>
            <input ref={eqNameRef} className="form-input" placeholder="e.g., MIG Welder" />
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Serial Number</label>
              <input ref={eqSerialRef} className="form-input" placeholder="e.g., SN-12345" />
            </div>
            <div className="form-group"><label className="form-label">Model</label>
              <input ref={eqModelRef} className="form-input" placeholder="e.g., Lincoln EM-350" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Workshop</label>
              <select ref={eqWsRef} className="form-input">
                <option value="">— No Workshop —</option>
                {workshops.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Department</label>
              <select ref={eqDeptRef} className="form-input">
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Status</label>
              <select ref={eqStatusRef} className="form-input">
                {EQ_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Condition</label>
              <select ref={eqCondRef} className="form-input">
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Next Maintenance Date</label>
            <input ref={eqNextRef} className="form-input" type="date" />
          </div>
          <div className="form-group"><label className="form-label">Notes</label>
            <textarea ref={eqNotesRef} className="form-input" rows={2} style={{ resize: "vertical" }} />
          </div>
        </div>
      </Modal>

      {/* ══════ MAINTENANCE LOG MODAL ══════ */}
      <Modal open={showMaintModal} onClose={() => { setShowMaintModal(false); setMaintTarget(null); }}
        title={`🔧 Log Maintenance — ${maintTarget?.name || ""}`} width={550}
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowMaintModal(false); setMaintTarget(null); }}>Cancel</button>
          <button className="btn btn-success" onClick={handleLogMaintenance}>Log Maintenance</button>
        </>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: "10px 14px", background: "var(--surface2)", borderRadius: 8, fontSize: 13 }}>
            <span style={{ color: "var(--text3)" }}>Equipment: </span>
            <strong>{maintTarget?.name}</strong>
            {maintTarget?.serial && <span style={{ color: "var(--text3)", marginLeft: 8, fontSize: 11 }}>S/N: {maintTarget.serial}</span>}
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Maintenance Type *</label>
              <select className="form-input" value={maintType} onChange={e => setMaintType(e.target.value)}>
                {MAINT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Technician *</label>
              <input ref={maintTechRef} className="form-input" placeholder="Technician name" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Cost (EGP)</label>
              <input ref={maintCostRef} className="form-input" type="number" step="0.01" defaultValue="0" />
            </div>
            <div className="form-group"><label className="form-label">Next Maintenance Date</label>
              <input ref={maintNextRef} className="form-input" type="date" />
            </div>
          </div>
          <div className="form-group"><label className="form-label">Update Equipment Status</label>
            <select className="form-input" value={maintStatus} onChange={e => setMaintStatus(e.target.value)}>
              {EQ_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Notes</label>
            <textarea ref={maintNotesRef} className="form-input" rows={3} placeholder="Work done, parts replaced, observations..." style={{ resize: "vertical" }} />
          </div>
        </div>
      </Modal>

      {/* ══════ EQUIPMENT HISTORY MODAL ══════ */}
      <Modal open={eqHistoryModal} onClose={() => setEqHistoryModal(false)}
        title={`📋 Maintenance History — ${historyEq?.name || ""}`} width={700}
        footer={<button className="btn btn-secondary" onClick={() => setEqHistoryModal(false)}>Close</button>}
      >
        <div className="table-wrap" style={{ maxHeight: 400, overflowY: "auto" }}>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Technician</th><th>Cost</th><th>Next Due</th><th>Notes</th></tr></thead>
            <tbody>
              {eqHistory.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize: 12 }}>{l.date}</td>
                  <td><span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: TYPE_STYLE[l.type]?.bg || "var(--surface2)",
                    color: TYPE_STYLE[l.type]?.color || "var(--text)" }}>{l.type}</span></td>
                  <td style={{ fontSize: 13 }}>{l.technician || "—"}</td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{l.cost > 0 ? `EGP ${Number(l.cost).toLocaleString()}` : "—"}</td>
                  <td style={{ fontSize: 12 }}>{l.next_date || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{l.notes || "—"}</td>
                </tr>
              ))}
              {eqHistory.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No maintenance history yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
