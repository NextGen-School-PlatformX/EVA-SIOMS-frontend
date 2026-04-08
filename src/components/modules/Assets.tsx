"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { KPICard, SearchBar, Badge, Modal } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { Icon } from "@/components/ui/Icon";
import { apiClient } from "@/services/apiClient";

const CONDITIONS = ["Excellent", "Good", "Fair", "Poor"];
const CATEGORIES  = ["General", "IT Equipment", "Power Tools", "Hand Tools", "Safety Gear", "Vehicles", "Office Equipment", "Lab Equipment"];

const ACTION_COLOR: Record<string, string> = {
  Issued: "#0055A5", Returned: "#2E7D32", Lost: "#C62828", Damaged: "#F57C00",
};

export default function Assets() {
  const toast = useToast();
  const [tab, setTab] = useState<"custody"|"logs"|"analytics">("custody");

  // Asset list state
  const [assets, setAssets]       = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [summary, setSummary]     = useState<any>(null);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading]     = useState(true);

  // Add Asset Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const assetNameRef  = useRef<HTMLInputElement>(null);
  const assetCatRef   = useRef<HTMLSelectElement>(null);
  const empSelectRef  = useRef<HTMLSelectElement>(null);
  const assignDateRef = useRef<HTMLInputElement>(null);
  const conditionRef  = useRef<HTMLSelectElement>(null);
  const purposeRef    = useRef<HTMLInputElement>(null);
  const notesRef      = useRef<HTMLTextAreaElement>(null);

  // Issue Modal (re-issue returned asset)
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueTarget, setIssueTarget]       = useState<any>(null);
  const issueHolderRef  = useRef<HTMLSelectElement>(null);
  const issuePurposeRef = useRef<HTMLInputElement>(null);
  const issueDateRef    = useRef<HTMLInputElement>(null);

  // Return Modal
  const [showReturnModal, setShowReturnModal]   = useState(false);
  const [returnTarget, setReturnTarget]         = useState<any>(null);
  const [returnCondition, setReturnCondition]   = useState("Good");
  const returnNotesRef = useRef<HTMLTextAreaElement>(null);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAsset, setEditAsset]         = useState<any>(null);
  const editNameRef   = useRef<HTMLInputElement>(null);
  const editCatRef    = useRef<HTMLSelectElement>(null);
  const editStatusRef = useRef<HTMLSelectElement>(null);
  const editCondRef   = useRef<HTMLSelectElement>(null);
  const editNotesRef  = useRef<HTMLTextAreaElement>(null);

  // Logs tab
  const [logs, setLogs]           = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState("All");
  const [logsLoading, setLogsLoading] = useState(false);

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Fetches ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [a, sum, emps] = await Promise.all([
        apiClient.get<any[]>(`/assets?search=${search}&status=${statusFilter === "All" ? "" : statusFilter}`),
        apiClient.get<any>('/assets/summary'),
        apiClient.get<any[]>('/assets/employees-list'),
      ]);
      setAssets(a); setSummary(sum); setEmployees(emps);
    } catch { toast("Failed to load assets", "error"); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try { setLogs(await apiClient.get<any[]>(`/assets/logs?action=${logFilter === "All" ? "" : logFilter}`)); }
    catch { toast("Failed to load logs", "error"); }
    finally { setLogsLoading(false); }
  }, [logFilter]);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try { setAnalytics(await apiClient.get<any>('/assets/analytics')); }
    catch { toast("Failed to load analytics", "error"); }
    finally { setAnalyticsLoading(false); }
  };

  useEffect(() => { if (tab === "custody") fetchData(); }, [tab, fetchData]);
  useEffect(() => { if (tab === "logs") fetchLogs(); }, [tab, fetchLogs]);
  useEffect(() => { if (tab === "analytics") fetchAnalytics(); }, [tab]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const name = assetNameRef.current?.value?.trim();
    const empVal = empSelectRef.current?.value;
    if (!name) { toast("Asset name is required", "error"); return; }
    if (!empVal) { toast("Employee is required", "error"); return; }
    const emp = employees.find(e => e.employeeId === empVal);
    if (!emp) { toast("Employee not found", "error"); return; }
    try {
      await apiClient.post('/assets', {
        name, category: assetCatRef.current?.value || "General",
        assignedTo: emp.name, employeeId: emp.employeeId,
        assignDate: assignDateRef.current?.value || new Date().toISOString().split('T')[0],
        condition: conditionRef.current?.value || "Good",
        purpose: purposeRef.current?.value || "",
        notes: notesRef.current?.value || "",
      });
      toast("Asset issued successfully", "success");
      setShowAddModal(false); fetchData();
    } catch (e: any) { toast(e.message || "Failed", "error"); }
  };

  const openIssue = (asset: any) => {
    setIssueTarget(asset);
    setShowIssueModal(true);
    setTimeout(() => {
      if (issueDateRef.current) issueDateRef.current.value = new Date().toISOString().split('T')[0];
    }, 50);
  };

  const handleIssue = async () => {
    if (!issueTarget) return;
    const empVal = issueHolderRef.current?.value;
    if (!empVal) { toast("Select an employee", "error"); return; }
    const emp = employees.find(e => e.employeeId === empVal);
    try {
      await apiClient.post('/assets/issue', {
        assetId: issueTarget.id,
        holder: emp?.name || empVal,
        employeeId: emp?.employeeId,
        date: issueDateRef.current?.value,
        purpose: issuePurposeRef.current?.value,
      });
      toast("Asset issued", "success"); setShowIssueModal(false); setIssueTarget(null); fetchData();
    } catch (e: any) { toast(e.message || "Failed", "error"); }
  };

  const openReturn = (asset: any) => {
    setReturnTarget(asset); setReturnCondition(asset.condition || "Good"); setShowReturnModal(true);
  };

  const handleReturn = async () => {
    if (!returnTarget) return;
    try {
      await apiClient.post('/assets/return', {
        assetId: returnTarget.id, condition: returnCondition,
        notes: returnNotesRef.current?.value || "",
      });
      toast("Asset returned successfully", "success");
      setShowReturnModal(false); setReturnTarget(null); fetchData();
    } catch (e: any) { toast(e.message || "Failed", "error"); }
  };

  const openEdit = (asset: any) => {
    setEditAsset(asset); setShowEditModal(true);
    setTimeout(() => {
      if (editNameRef.current)   editNameRef.current.value   = asset.name || "";
      if (editCatRef.current)    editCatRef.current.value    = asset.category || "General";
      if (editStatusRef.current) editStatusRef.current.value = asset.status || "In Use";
      if (editCondRef.current)   editCondRef.current.value   = asset.condition || "Good";
      if (editNotesRef.current)  editNotesRef.current.value  = asset.notes || "";
    }, 50);
  };

  const handleSaveEdit = async () => {
    if (!editAsset) return;
    const name = editNameRef.current?.value?.trim();
    if (!name) { toast("Asset name is required", "error"); return; }
    try {
      await apiClient.put(`/assets/${editAsset.id}`, {
        name, category: editCatRef.current?.value,
        status: editStatusRef.current?.value,
        condition: editCondRef.current?.value,
        notes: editNotesRef.current?.value,
        assigned_to: editAsset.assignedTo,
        employee_id: editAsset.employeeId,
      });
      toast("Asset updated", "success"); setShowEditModal(false); setEditAsset(null); fetchData();
    } catch (e: any) { toast(e.message || "Failed", "error"); }
  };

  const handleDelete = async (asset: any) => {
    if (!confirm(`Delete asset "${asset.name}"?`)) return;
    try { await apiClient.delete(`/assets/${asset.id}`); toast("Deleted", "success"); fetchData(); }
    catch { toast("Failed to delete", "error"); }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const TABS = [
    { id: "custody",   label: "🗂️ Custody Register" },
    { id: "logs",      label: "📋 Activity Log"     },
    { id: "analytics", label: "📊 Analytics"        },
  ];

  return (
    <div className="fade-in">
      {/* Tabs */}
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

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 20 }}>
        <KPICard icon="assets" label="Total Assets"    value={summary?.total ?? "—"}    color="#0055A5" bg="rgba(0,85,165,0.1)"   />
        <KPICard icon="trend"  label="In Custody"      value={summary?.inUse ?? "—"}    color="#F57C00" bg="rgba(245,124,0,0.1)"  />
        <KPICard icon="check"  label="Returned"        value={summary?.returned ?? "—"} color="#2E7D32" bg="rgba(46,125,50,0.1)"  />
        <KPICard icon="alert"  label="Lost"            value={summary?.lost ?? "—"}     color="#C62828" bg="rgba(198,40,40,0.1)"  />
        <KPICard icon="close"  label="Damaged"         value={summary?.damaged ?? "—"}  color="#7B1FA2" bg="rgba(123,31,162,0.1)" />
      </div>

      {/* ══════════════ CUSTODY REGISTER TAB ══════════════ */}
      {tab === "custody" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Asset Custody Register ({assets.length})</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              <Icon name="plus" size={14} />Issue Asset
            </button>
          </div>
          <div className="filter-bar" style={{ padding: 15, display: "flex", gap: 10 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search asset or employee..." />
            {["All", "In Use", "Returned", "Lost", "Damaged"].map(s => (
              <button key={s} className={`btn btn-xs ${statusFilter === s ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setStatusFilter(s)}>{s}</button>
            ))}
          </div>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Loading...</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Asset</th><th>Category</th><th>Holder</th><th>Issued</th><th>Returned</th><th>Status</th><th>Condition</th><th>Purpose</th><th style={{ textAlign: "right", paddingRight: 16 }}>Actions</th></tr>
                </thead>
                <tbody>
                  {assets.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "monospace" }}>{a.assetId}</div>
                      </td>
                      <td><span style={{ fontSize: 11, background: "rgba(0,169,206,0.1)", color: "#00A9CE", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>{a.category}</span></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{a.assignedTo || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{a.employeeId}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{a.issuedDate || a.assignDate || "—"}</td>
                      <td style={{ fontSize: 12, color: a.returnDate ? "var(--text2)" : "var(--text3)" }}>{a.returnDate || "—"}</td>
                      <td><Badge status={a.status} /></td>
                      <td><Badge status={a.condition} /></td>
                      <td style={{ fontSize: 12, color: "var(--text3)", maxWidth: 120 }}>{a.purpose || "—"}</td>
                      <td style={{ textAlign: "right", paddingRight: 16 }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          {a.status === "In Use" && <>
                            <button className="btn btn-xs btn-secondary" onClick={() => openEdit(a)}><Icon name="edit" size={12} /></button>
                            <button className="btn btn-xs" style={{ background: "rgba(46,125,50,0.1)", color: "#2E7D32", border: "1px solid rgba(46,125,50,0.2)" }}
                              onClick={() => openReturn(a)}>↩ Return</button>
                          </>}
                          {a.status === "Returned" &&
                            <button className="btn btn-xs btn-primary" onClick={() => openIssue(a)}>Re-Issue</button>
                          }
                          <button className="btn btn-xs btn-danger" onClick={() => handleDelete(a)}><Icon name="trash" size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {assets.length === 0 && !loading && (
                    <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>No assets found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ACTIVITY LOG TAB ══════════════ */}
      {tab === "logs" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Asset Activity Log</span>
          </div>
          <div className="filter-bar" style={{ padding: 15, display: "flex", gap: 8 }}>
            {["All", "Issued", "Returned", "Lost", "Damaged"].map(a => (
              <button key={a} className={`btn btn-xs ${logFilter === a ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setLogFilter(a)}>{a}</button>
            ))}
          </div>
          {logsLoading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Loading...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Asset</th><th>Action</th><th>User / Holder</th><th>Condition</th><th>Date</th><th>Notes</th></tr></thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.asset_name}</td>
                      <td>
                        <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                          background: `${ACTION_COLOR[l.action] || "#0055A5"}18`,
                          color: ACTION_COLOR[l.action] || "#0055A5" }}>
                          {l.action === "Issued" ? "📤" : l.action === "Returned" ? "📥" : l.action === "Lost" ? "❌" : "⚠️"} {l.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{l.user_name || "—"}</td>
                      <td>{l.condition ? <Badge status={l.condition} /> : "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text3)" }}>{l.date}</td>
                      <td style={{ fontSize: 12, color: "var(--text2)", maxWidth: 200 }}>{l.notes || "—"}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>No activity logs yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ANALYTICS TAB ══════════════ */}
      {tab === "analytics" && (
        <div className="fade-in">
          {analyticsLoading ? <div style={{ padding: 60, textAlign: "center", color: "var(--text3)" }}>Loading...</div> : analytics && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                {/* Status Breakdown */}
                <div className="card">
                  <div className="card-header"><span className="card-title">Assets by Status</span></div>
                  <div style={{ padding: "0 0 16px" }}>
                    {analytics.byStatus?.map((s: any) => {
                      const col = s.status === "In Use" ? "#F57C00" : s.status === "Returned" ? "#2E7D32" : s.status === "Lost" ? "#C62828" : "#7B1FA2";
                      return (
                        <div key={s.status} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "12px 16px", margin: "4px 0",
                          background: `${col}12`, borderRadius: 8 }}>
                          <span style={{ fontWeight: 600, color: col }}>{s.status}</span>
                          <span style={{ fontSize: 24, fontWeight: 800 }}>{s.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* By Category */}
                <div className="card">
                  <div className="card-header"><span className="card-title">Assets by Category</span></div>
                  <div style={{ padding: "10px 16px 16px" }}>
                    {analytics.byCategory?.map((c: any) => {
                      const max = Math.max(...(analytics.byCategory?.map((x: any) => x.count || 0) || [1]), 1);
                      return (
                        <div key={c.category} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{c.category}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#0055A5" }}>{c.count}</span>
                          </div>
                          <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${(c.count / max) * 100}%`, height: "100%",
                              background: "linear-gradient(90deg,#0055A5,#00A9CE)", borderRadius: 4 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Top Holders */}
              {analytics.topHolders?.length > 0 && (
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-header"><span className="card-title">Top Asset Holders (In Custody)</span></div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>#</th><th>Employee</th><th>Assets in Custody</th></tr></thead>
                      <tbody>
                        {analytics.topHolders.map((h: any, i: number) => (
                          <tr key={i}>
                            <td style={{ color: "var(--text3)", fontSize: 13 }}>{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>{h.assigned_to}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: `${(h.count / (analytics.topHolders[0]?.count || 1)) * 120}px`, height: 8, background: "#0055A5", borderRadius: 4 }} />
                                <span style={{ fontWeight: 700, color: "#0055A5" }}>{h.count}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div className="card">
                <div className="card-header"><span className="card-title">Recent Activity</span></div>
                <div style={{ padding: "0 0 16px" }}>
                  {analytics.recentLogs?.map((l: any) => (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: `${ACTION_COLOR[l.action] || "#0055A5"}18`, fontSize: 18 }}>
                        {l.action === "Issued" ? "📤" : l.action === "Returned" ? "📥" : l.action === "Lost" ? "❌" : "⚠️"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{l.asset_name}</div>
                        <div style={{ fontSize: 12, color: "var(--text3)" }}>
                          <span style={{ color: ACTION_COLOR[l.action] || "#0055A5", fontWeight: 600 }}>{l.action}</span>
                          {l.user_name && ` · ${l.user_name}`}
                          {l.notes && ` · ${l.notes}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text3)" }}>{l.date}</div>
                    </div>
                  ))}
                  {(!analytics.recentLogs?.length) && <div style={{ padding: 20, textAlign: "center", color: "var(--text3)" }}>No activity yet</div>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════ ADD / ISSUE MODAL ══════ */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Issue New Asset" width={560}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd}>Issue Asset</button>
        </>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group"><label className="form-label">Asset Name *</label>
            <input ref={assetNameRef} className="form-input" placeholder="e.g., Laptop Dell XPS, Safety Helmet" />
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Category</label>
              <select ref={assetCatRef} className="form-input">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Condition</label>
              <select ref={conditionRef} className="form-input">
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Issue To (Employee) *</label>
            <select ref={empSelectRef} className="form-input">
              <option value="">— Select Employee —</option>
              {employees.map(e => <option key={e.id} value={e.employeeId}>{e.name} ({e.employeeId})</option>)}
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Issue Date</label>
              <input ref={assignDateRef} className="form-input" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="form-group"><label className="form-label">Purpose</label>
              <input ref={purposeRef} className="form-input" placeholder="e.g., Field work, Training" />
            </div>
          </div>
          <div className="form-group"><label className="form-label">Notes</label>
            <textarea ref={notesRef} className="form-input" rows={2} style={{ resize: "vertical" }} />
          </div>
        </div>
      </Modal>

      {/* ══════ RE-ISSUE MODAL ══════ */}
      <Modal open={showIssueModal} onClose={() => { setShowIssueModal(false); setIssueTarget(null); }}
        title={`Re-Issue Asset — ${issueTarget?.name || ""}`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowIssueModal(false); setIssueTarget(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleIssue}>Issue Asset</button>
        </>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: "10px 14px", background: "var(--surface2)", borderRadius: 8, fontSize: 13 }}>
            <span style={{ color: "var(--text3)" }}>Asset: </span><strong>{issueTarget?.name}</strong>
            <span style={{ marginLeft: 12, color: "var(--text3)" }}>Category: </span>{issueTarget?.category}
          </div>
          <div className="form-group"><label className="form-label">Issue To *</label>
            <select ref={issueHolderRef} className="form-input">
              <option value="">— Select Employee —</option>
              {employees.map(e => <option key={e.id} value={e.employeeId}>{e.name} ({e.employeeId})</option>)}
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Date</label>
              <input ref={issueDateRef} className="form-input" type="date" />
            </div>
            <div className="form-group"><label className="form-label">Purpose</label>
              <input ref={issuePurposeRef} className="form-input" placeholder="Purpose / reason" />
            </div>
          </div>
        </div>
      </Modal>

      {/* ══════ RETURN MODAL ══════ */}
      <Modal open={showReturnModal} onClose={() => { setShowReturnModal(false); setReturnTarget(null); }}
        title={`Return Asset — ${returnTarget?.name || ""}`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowReturnModal(false); setReturnTarget(null); }}>Cancel</button>
          <button className="btn btn-success" onClick={handleReturn}>Confirm Return</button>
        </>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: "10px 14px", background: "rgba(46,125,50,0.08)", borderRadius: 8, fontSize: 13, border: "1px solid rgba(46,125,50,0.2)" }}>
            Returning <strong>{returnTarget?.name}</strong> from <strong>{returnTarget?.assignedTo}</strong>
          </div>
          <div className="form-group"><label className="form-label">Returned Condition *</label>
            <div style={{ display: "flex", gap: 8 }}>
              {CONDITIONS.map(c => (
                <button key={c} onClick={() => setReturnCondition(c)}
                  className={`btn btn-sm ${returnCondition === c ? "btn-primary" : "btn-secondary"}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="form-group"><label className="form-label">Notes / Observations</label>
            <textarea ref={returnNotesRef} className="form-input" rows={3}
              placeholder="Any damage, missing parts, or observations..." style={{ resize: "vertical" }} />
          </div>
        </div>
      </Modal>

      {/* ══════ EDIT MODAL ══════ */}
      <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditAsset(null); }}
        title={`Edit Asset — ${editAsset?.name || ""}`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditAsset(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
        </>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group"><label className="form-label">Asset Name *</label>
            <input ref={editNameRef} className="form-input" />
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Category</label>
              <select ref={editCatRef} className="form-input">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Status</label>
              <select ref={editStatusRef} className="form-input">
                <option>In Use</option><option>Returned</option><option>Lost</option><option>Damaged</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Condition</label>
            <select ref={editCondRef} className="form-input">
              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {editAsset && (
            <div style={{ padding: 12, background: "var(--surface2)", borderRadius: 8, fontSize: 13 }}>
              <span style={{ color: "var(--text3)" }}>Holder: </span><strong>{editAsset.assignedTo}</strong>
              <span style={{ color: "var(--text3)", marginLeft: 12 }}>ID: </span>{editAsset.employeeId}
            </div>
          )}
          <div className="form-group"><label className="form-label">Notes</label>
            <textarea ref={editNotesRef} className="form-input" rows={2} style={{ resize: "vertical" }} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
