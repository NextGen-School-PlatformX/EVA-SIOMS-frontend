"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { KPICard, SearchBar, Pagination, Badge, Modal, Tabs } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { Icon } from "@/components/ui/Icon";
import { apiClient } from "@/services/apiClient";
import type { Employee } from "@/types";

const DEPARTMENTS = ["HR","Finance","IT","Operations","Workshop","Inventory","Canteen","Security","Admin","Maintenance"];
const LEAVE_TYPES = ["Annual Leave","Sick Leave","Emergency Leave","Maternity/Paternity Leave","Unpaid Leave"];
const TABS = [
  { id:"employees", label:"Employees" },
  { id:"leaves",    label:"Leave Requests" },
  { id:"overtime",  label:"Overtime" },
  { id:"bonuses",   label:"Bonuses" },
  { id:"penalties", label:"Penalties" },
];

// Current month helper
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

export default function HR() {
  const toast = useToast();
  const [tab, setTab]               = useState("employees");
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]); // for dropdowns
  const [leaves, setLeaves]         = useState<any[]>([]);
  const [penalties, setPenalties]   = useState<any[]>([]);
  const [overtimes, setOvertimes]   = useState<any[]>([]);
  const [bonuses, setBonuses]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [month, setMonth]           = useState(currentMonth());
  const [overtimeRate, setOvertimeRate] = useState(50);

  // Modals
  const [showModal, setShowModal]               = useState(false);
  const [showLeaveModal, setShowLeaveModal]     = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [showBonusModal, setShowBonusModal]     = useState(false);
  const [showLoginModal, setShowLoginModal]     = useState(false);
  const [showImportModal, setShowImportModal]   = useState(false);
  const [showBulkResultModal, setShowBulkResultModal] = useState(false);
  const [showRateModal, setShowRateModal]       = useState(false);
  const [bulkResults, setBulkResults]           = useState<any>(null);
  const [bulkAccountsLoading, setBulkAccountsLoading] = useState(false);
  const [loginEmp, setLoginEmp]                 = useState<Employee | null>(null);
  const [selectedEmp, setSelectedEmp]           = useState<Employee | null>(null);
  const [leaveManageModal, setLeaveManageModal] = useState<any>(null);
  const perPage = 10;

  // Employee form refs
  const nameRef  = useRef<HTMLInputElement>(null);
  const deptRef  = useRef<HTMLSelectElement>(null);
  const posRef   = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const salRef   = useRef<HTMLInputElement>(null);
  const dateRef  = useRef<HTMLInputElement>(null);

  // Leave form refs
  const leaveEmpRef  = useRef<HTMLSelectElement>(null);
  const leaveTypeRef = useRef<HTMLSelectElement>(null);
  const leaveFromRef = useRef<HTMLInputElement>(null);
  const leaveToRef   = useRef<HTMLInputElement>(null);

  // Penalty form state
  const [penEmp, setPenEmp]   = useState("");
  const [penReason, setPenReason] = useState("");
  const [penAmount, setPenAmount] = useState("");
  const [penDate, setPenDate] = useState(new Date().toISOString().split('T')[0]);

  // Overtime form state
  const [ovEmp, setOvEmp]     = useState<Employee | null>(null);
  const [ovHours, setOvHours] = useState("");
  const [ovNote, setOvNote]   = useState("");
  const [ovRate, setOvRate]   = useState(""); // specific rate per employee (optional)

  // Bonus form state
  const [boEmp, setBoEmp]     = useState<Employee | null>(null);
  const [boAmount, setBoAmount] = useState("");
  const [boReason, setBoReason] = useState("");

  // Rate modal state
  const [newRate, setNewRate] = useState("");

  // Employee Tax Modal state
  const [showEmpTaxModal, setShowEmpTaxModal] = useState(false);
  const [empTaxTarget, setEmpTaxTarget]       = useState<Employee | null>(null);
  const [empTaxes, setEmpTaxes]               = useState<{name:string;rate:number}[]>([]);
  const [empTaxLoading, setEmpTaxLoading]     = useState(false);
  const [empTaxUseGlobal, setEmpTaxUseGlobal] = useState(true);

  // ── Fetches ──────────────────────────────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(`/employees?search=${search}&page=${page}&limit=${perPage}`);
      setEmployees(res.data); setTotal(res.total);
    } catch { toast("Failed to load employees","error"); }
    finally { setLoading(false); }
  }, [search, page]);

  // Fetch ALL employees for dropdowns (no pagination)
  const fetchAllEmployees = useCallback(async () => {
    try {
      const data = await apiClient.get<Employee[]>('/employees/all');
      setAllEmployees(data);
    } catch {
      // fallback: try getting all with high limit
      try {
        const res = await apiClient.get<any>('/employees?limit=1000&page=1');
        setAllEmployees(res.data || []);
      } catch {}
    }
  }, []);

  const fetchLeaves    = async () => {
    try { setLeaves(await apiClient.get<any[]>('/hr/leaves')); }
    catch { toast("Failed to load leaves","error"); }
  };
  const fetchPenalties = async () => {
    try { setPenalties(await apiClient.get<any[]>(`/hr/penalties?month=${month}`)); }
    catch { toast("Failed to load penalties","error"); }
  };
  const fetchOvertimes = async () => {
    try { setOvertimes(await apiClient.get<any[]>(`/hr/overtime?month=${month}`)); }
    catch { toast("Failed to load overtime","error"); }
  };
  const fetchBonuses   = async () => {
    try { setBonuses(await apiClient.get<any[]>(`/hr/bonuses?month=${month}`)); }
    catch { toast("Failed to load bonuses","error"); }
  };
  const fetchRate = async () => {
    try {
      const r = await apiClient.get<any>('/hr/overtime-rate');
      setOvertimeRate(r.overtime_rate);
      setNewRate(String(r.overtime_rate));
    } catch {}
  };

  useEffect(() => { fetchEmployees(); }, [search, page]);
  useEffect(() => { fetchAllEmployees(); }, []); // load all for dropdowns once
  useEffect(() => {
    if (tab==="leaves")    fetchLeaves();
    if (tab==="penalties") fetchPenalties();
    if (tab==="overtime")  { fetchOvertimes(); fetchRate(); }
    if (tab==="bonuses")   fetchBonuses();
  }, [tab, month]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const name = nameRef.current?.value?.trim();
    const dept = deptRef.current?.value?.trim();
    const pos  = posRef.current?.value?.trim();
    const email= emailRef.current?.value?.trim();
    const phone= phoneRef.current?.value?.trim();
    const sal  = salRef.current?.value?.trim();
    if (!name || name.length < 3)  { toast("Full name is required (min 3 chars)","error"); return false; }
    if (!dept)                      { toast("Department is required","error"); return false; }
    if (!pos)                       { toast("Position is required","error"); return false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("Valid email required","error"); return false; }
    if (!phone || !/^(\+|00)?[0-9\s\-()]{7,}$/.test(phone)) { toast("Valid phone required","error"); return false; }
    const salary = parseFloat(sal || '0');
    if (isNaN(salary) || salary < 1000) { toast("Salary must be at least 1000 EGP","error"); return false; }
    return true;
  };

  const handleSaveEmployee = async () => {
    if (!validateForm()) return;
    const body = {
      name: nameRef.current?.value, department: deptRef.current?.value,
      position: posRef.current?.value, email: emailRef.current?.value,
      phone: phoneRef.current?.value, salary: parseFloat(salRef.current?.value||'0'),
      joinDate: dateRef.current?.value,
    };
    try {
      if (selectedEmp) { await apiClient.put(`/employees/${selectedEmp.id}`, body); toast("Employee updated","success"); }
      else             { await apiClient.post('/employees', body); toast("Employee added","success"); }
      setShowModal(false); fetchEmployees();
    } catch (e: any) { toast(e.message || "Failed","error"); }
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Delete ${emp.name}?`)) return;
    try { await apiClient.delete(`/employees/${emp.id}`); toast(`${emp.name} deleted`,"success"); fetchEmployees(); }
    catch { toast("Failed to delete","error"); }
  };

  const handleSubmitLeave = async () => {
    const employee = leaveEmpRef.current?.value?.trim();
    const type     = leaveTypeRef.current?.value;
    const from_date= leaveFromRef.current?.value;
    const to_date  = leaveToRef.current?.value;
    if (!employee)           { toast("Select an employee","error"); return; }
    if (!from_date||!to_date){ toast("Dates required","error"); return; }
    if (new Date(from_date) > new Date(to_date)) { toast("From date cannot be after To date","error"); return; }
    const days = Math.ceil((new Date(to_date).getTime()-new Date(from_date).getTime())/(1000*60*60*24))+1;
    const sel  = allEmployees.find(e => e.name === employee);
    try {
      await apiClient.post('/hr/leaves',{ employee, employee_id: sel?.employeeId, type, from_date, to_date, days });
      toast("Leave request submitted","success"); setShowLeaveModal(false); fetchLeaves();
    } catch (e: any) { toast(e.message||"Failed","error"); }
  };

  const handleLeaveStatus = async (id: number, status: string, hr_note?: string) => {
    try {
      await apiClient.post(`/hr/leaves/${id}/status`,{ status, hr_note: hr_note||'' });
      toast(`Leave ${status.toLowerCase()}. Employee notified via email.`,"success");
      fetchLeaves(); setLeaveManageModal(null);
    } catch { toast("Failed to update","error"); }
  };

  const handleSubmitPenalty = async () => {
    if (!penEmp)                         { toast("Select an employee","error"); return; }
    if (!penReason || penReason.length<3){ toast("Reason required (min 3 chars)","error"); return; }
    if (!penAmount || parseFloat(penAmount)<=0){ toast("Amount must be > 0","error"); return; }
    if (!penDate)                        { toast("Date required","error"); return; }
    try {
      await apiClient.post('/hr/penalties',{ employee: penEmp, reason: penReason, amount: parseFloat(penAmount), date: penDate });
      toast("Penalty recorded","success");
      setShowPenaltyModal(false); setPenEmp(""); setPenReason(""); setPenAmount(""); fetchPenalties();
    } catch (e: any) { toast(e.message||"Failed","error"); }
  };

  const handleSubmitOvertime = async () => {
    if (!ovEmp)             { toast("Select an employee","error"); return; }
    if (!ovHours || parseFloat(ovHours)<=0){ toast("Hours must be > 0","error"); return; }
    // Use specific rate if provided, otherwise send nothing (backend uses global)
    const specificRate = ovRate && parseFloat(ovRate) > 0 ? parseFloat(ovRate) : undefined;
    try {
      await apiClient.post('/hr/overtime',{
        employee_id: ovEmp.employeeId, employee: ovEmp.name,
        department: ovEmp.department, month,
        hours: parseFloat(ovHours),
        rate_per_hour: specificRate, // undefined = backend uses global rate
        note: ovNote,
      });
      toast("Overtime saved","success");
      setShowOvertimeModal(false); setOvEmp(null); setOvHours(""); setOvNote(""); setOvRate(""); fetchOvertimes();
    } catch (e: any) { toast(e.message||"Failed","error"); }
  };

  // ── Employee Tax Handlers ──────────────────────────────────────────────────
  const openEmpTaxModal = async (emp: Employee) => {
    setEmpTaxTarget(emp);
    setShowEmpTaxModal(true);
    setEmpTaxLoading(true);
    try {
      const r = await apiClient.get<any>(`/hr/employee-taxes/${emp.employeeId}`);
      if (r.payroll_taxes && Array.isArray(r.payroll_taxes)) {
        setEmpTaxes(r.payroll_taxes);
        setEmpTaxUseGlobal(false);
      } else {
        // Load global defaults to show
        const g = await apiClient.get<any>('/hr/payroll-settings');
        setEmpTaxes(g.payroll_taxes || []);
        setEmpTaxUseGlobal(true);
      }
    } catch { setEmpTaxes([]); setEmpTaxUseGlobal(true); }
    finally { setEmpTaxLoading(false); }
  };

  const handleSaveEmpTaxes = async () => {
    if (!empTaxTarget) return;
    try {
      const val = empTaxUseGlobal ? null : empTaxes;
      await apiClient.post(`/hr/employee-taxes/${empTaxTarget.employeeId}`, { payroll_taxes: val });
      toast(empTaxUseGlobal ? "Using global rates" : "Custom rates saved", "success");
      setShowEmpTaxModal(false);
    } catch (e: any) { toast(e.message || "Failed", "error"); }
  };

  const handleSubmitBonus = async () => {
    if (!boEmp)             { toast("Select an employee","error"); return; }
    if (!boAmount || parseFloat(boAmount)<=0){ toast("Amount must be > 0","error"); return; }
    try {
      await apiClient.post('/hr/bonuses',{
        employee_id: boEmp.employeeId, employee: boEmp.name,
        department: boEmp.department, month,
        amount: parseFloat(boAmount), reason: boReason,
      });
      toast("Bonus added","success");
      setShowBonusModal(false); setBoEmp(null); setBoAmount(""); setBoReason(""); fetchBonuses();
    } catch (e: any) { toast(e.message||"Failed","error"); }
  };

  const handleSaveRate = async () => {
    const rate = parseFloat(newRate);
    if (isNaN(rate)||rate<=0){ toast("Enter a valid rate","error"); return; }
    try {
      await apiClient.post('/hr/overtime-rate',{ rate });
      setOvertimeRate(rate); toast(`Rate updated to EGP ${rate}/hr`,"success"); setShowRateModal(false);
    } catch (e: any) { toast(e.message||"Failed","error"); }
  };

  const handleBulkCreateAccounts = async () => {
    if (!confirm("Create accounts for all employees without accounts? They will receive credentials via email.")) return;
    setBulkAccountsLoading(true);
    try {
      const result = await apiClient.post<any>('/hr/employees/bulk-create-accounts',{});
      setBulkResults(result); setShowBulkResultModal(true);
      toast(result.message, result.created>0?"success":"error");
    } catch (e: any) { toast(e.message||"Failed","error"); }
    finally { setBulkAccountsLoading(false); }
  };

  // ── Month Selector (shared across tabs) ──────────────────────────────────────
  const MonthSelector = () => (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ fontSize:12, color:"var(--text3)" }}>Month:</span>
      <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
        className="form-input" style={{ padding:"4px 10px", fontSize:13, width:150 }} />
    </div>
  );

  // ── Status helpers ────────────────────────────────────────────────────────────
  const statusBg: Record<string,string>   = { Approved:"rgba(46,125,50,0.1)", Rejected:"rgba(198,40,40,0.1)", Pending:"rgba(245,124,0,0.1)" };
  const statusClr: Record<string,string>  = { Approved:"#2E7D32", Rejected:"#C62828", Pending:"#F57C00" };
  const statusIcon: Record<string,string> = { Approved:"✅", Rejected:"❌", Pending:"⏳" };

  return (
    <div className="fade-in">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ══════════════════ EMPLOYEES ══════════════════ */}
      {tab==="employees" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Employee Directory ({total})</span>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              <button className="btn btn-secondary btn-sm" onClick={()=>setShowImportModal(true)}>
                <Icon name="upload" size={14} />Import CSV
              </button>
              <button className="btn btn-sm"
                style={{ background:"linear-gradient(135deg,#0055A5,#00A9CE)",color:"#fff",border:"none" }}
                onClick={handleBulkCreateAccounts} disabled={bulkAccountsLoading}>
                {bulkAccountsLoading?"Creating...":"🔑 Create All Accounts"}
              </button>
              <button className="btn btn-primary btn-sm" onClick={()=>{ setSelectedEmp(null); setShowModal(true); }}>
                <Icon name="plus" size={14} />Add Employee
              </button>
            </div>
          </div>
          <div className="filter-bar">
            <SearchBar value={search} onChange={v=>{setSearch(v);setPage(1);}} placeholder="Search by name, ID, department..." />
          </div>
          {loading ? <div style={{ padding:40,textAlign:'center',color:'var(--text3)' }}>Loading...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Employee</th><th>Department</th><th>Position</th><th>Status</th><th>Salary</th><th>Attendance</th><th>Actions</th></tr></thead>
                <tbody>
                  {employees.map(emp=>(
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                          <div className="avatar">{emp.name[0]}</div>
                          <div>
                            <div style={{ fontWeight:500 }}>{emp.name}</div>
                            <div style={{ fontSize:11,color:"var(--text3)" }}>{emp.employeeId} · {emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{emp.department}</td>
                      <td style={{ color:"var(--text2)",fontSize:13 }}>{emp.position}</td>
                      <td><Badge status={emp.status} /></td>
                      <td style={{ fontWeight:500 }}>EGP {emp.salary.toLocaleString()}</td>
                      <td>
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <div style={{ flex:1,maxWidth:80 }}>
                            <div className="progress">
                              <div className="progress-fill" style={{
                                width:`${emp.attendance}%`,
                                background:emp.attendance>85?"linear-gradient(90deg,#2E7D32,#4CAF50)":emp.attendance>70?"linear-gradient(90deg,#F57C00,#FF9800)":"linear-gradient(90deg,#C62828,#F44336)"
                              }} />
                            </div>
                          </div>
                          <span style={{ fontSize:12,color:"var(--text2)" }}>{emp.attendance}%</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display:"flex",gap:6 }}>
                          <button className="btn btn-xs btn-secondary" onClick={()=>{ setSelectedEmp(emp); setShowModal(true); }} title="Edit">
                            <Icon name="edit" size={12} />
                          </button>
                          <button className="btn btn-xs" onClick={()=> openEmpTaxModal(emp)}
                            title="Tax & Insurance Settings"
                            style={{ background:"rgba(46,125,50,0.1)",color:"#2E7D32",border:"1px solid rgba(46,125,50,0.2)",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:11 }}>
                            💰
                          </button>
                          <button className="btn btn-xs" onClick={()=>{ setLoginEmp(emp); setShowLoginModal(true); }}
                            title="Set login"
                            style={{ background:"rgba(0,85,165,0.1)",color:"#0055A5",border:"1px solid rgba(0,85,165,0.2)",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:11 }}>
                            🔑
                          </button>
                          <button className="btn btn-xs btn-danger" onClick={()=>handleDelete(emp)}>
                            <Icon name="trash" size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination total={total} perPage={perPage} page={page} setPage={setPage} />
        </div>
      )}

      {/* ══════════════════ LEAVE REQUESTS ══════════════════ */}
      {tab==="leaves" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Leave Requests</span>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowLeaveModal(true)}>
              <Icon name="plus" size={14} />New Request
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Period</th><th>Days</th><th>Source</th><th>Status</th><th>HR Note</th><th>Actions</th></tr></thead>
              <tbody>
                {leaves.map(l=>(
                  <tr key={l.id}>
                    <td style={{ fontWeight:500 }}>{l.employee}</td>
                    <td style={{ fontSize:13 }}>{l.type}</td>
                    <td style={{ fontSize:12,color:"var(--text2)" }}>{l.from_date} → {l.to_date}</td>
                    <td><strong>{l.days}</strong></td>
                    <td>
                      <span style={{ fontSize:11,padding:"2px 8px",borderRadius:4,
                        background:l.source==='employee'?"rgba(0,85,165,0.1)":"rgba(0,0,0,0.06)",
                        color:l.source==='employee'?"#0055A5":"var(--text2)" }}>
                        {l.source==='employee'?'👤 Self':'🏢 HR'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize:12,padding:"3px 10px",borderRadius:6,fontWeight:600,
                        background:statusBg[l.status]||"rgba(0,0,0,0.06)",color:statusClr[l.status]||"var(--text2)" }}>
                        {statusIcon[l.status]} {l.status}
                      </span>
                    </td>
                    <td style={{ maxWidth:140,fontSize:12,color:"var(--text2)" }}>
                      {l.hr_note ? (
                        <span title={l.hr_note} style={{ display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                          💬 {l.hr_note}
                        </span>
                      ) : <span style={{ color:"var(--text3)",fontSize:11 }}>—</span>}
                    </td>
                    <td>
                      <button className="btn btn-xs btn-secondary" onClick={()=>setLeaveManageModal(l)}>
                        ✏️ Manage
                      </button>
                    </td>
                  </tr>
                ))}
                {leaves.length===0 && (
                  <tr><td colSpan={8} style={{ textAlign:"center",padding:32,color:"var(--text3)" }}>No leave requests yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════ OVERTIME ══════════════════ */}
      {tab==="overtime" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Overtime Entries</span>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <MonthSelector />
              <button className="btn btn-secondary btn-sm" onClick={()=>setShowRateModal(true)}>
                ⚙️ Rate: EGP {overtimeRate}/hr
              </button>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowOvertimeModal(true)}>
                <Icon name="plus" size={14} />Add Overtime
              </button>
            </div>
          </div>

          {/* Summary */}
          {overtimes.length > 0 && (
            <div style={{ padding:"12px 20px",borderBottom:"1px solid var(--border)",display:"flex",gap:24 }}>
              <div style={{ fontSize:13 }}>
                <span style={{ color:"var(--text3)" }}>Total Hours: </span>
                <strong>{overtimes.reduce((s,o)=>s+o.hours,0).toFixed(1)} hrs</strong>
              </div>
              <div style={{ fontSize:13 }}>
                <span style={{ color:"var(--text3)" }}>Total Cost: </span>
                <strong style={{ color:"#2E7D32" }}>EGP {overtimes.reduce((s,o)=>s+o.total,0).toLocaleString()}</strong>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Department</th><th>Hours</th><th>Rate/hr</th><th>Total</th><th>Note</th><th>Actions</th></tr></thead>
              <tbody>
                {overtimes.map(o=>(
                  <tr key={o.id}>
                    <td style={{ fontWeight:500 }}>{o.employee}</td>
                    <td style={{ fontSize:13,color:"var(--text2)" }}>{o.department}</td>
                    <td><strong>{o.hours}</strong> hrs</td>
                    <td style={{ fontSize:13 }}>EGP {o.rate_per_hour}</td>
                    <td style={{ fontWeight:600,color:"#2E7D32" }}>EGP {o.total.toLocaleString()}</td>
                    <td style={{ fontSize:12,color:"var(--text2)" }}>{o.note||"—"}</td>
                    <td>
                      <button className="btn btn-xs btn-danger" onClick={async()=>{ await apiClient.delete(`/hr/overtime/${o.id}`); fetchOvertimes(); }}>
                        <Icon name="trash" size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {overtimes.length===0 && (
                  <tr><td colSpan={7} style={{ textAlign:"center",padding:32,color:"var(--text3)" }}>No overtime entries for {month}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════ BONUSES ══════════════════ */}
      {tab==="bonuses" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Bonus Entries</span>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <MonthSelector />
              <button className="btn btn-primary btn-sm" onClick={()=>setShowBonusModal(true)}>
                <Icon name="plus" size={14} />Add Bonus
              </button>
            </div>
          </div>

          {bonuses.length > 0 && (
            <div style={{ padding:"12px 20px",borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:13,color:"var(--text3)" }}>Total Bonuses: </span>
              <strong style={{ color:"#2E7D32" }}>EGP {bonuses.reduce((s,b)=>s+b.amount,0).toLocaleString()}</strong>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Department</th><th>Amount</th><th>Reason</th><th>Actions</th></tr></thead>
              <tbody>
                {bonuses.map(b=>(
                  <tr key={b.id}>
                    <td style={{ fontWeight:500 }}>{b.employee}</td>
                    <td style={{ fontSize:13,color:"var(--text2)" }}>{b.department}</td>
                    <td style={{ fontWeight:600,color:"#2E7D32" }}>EGP {b.amount.toLocaleString()}</td>
                    <td style={{ fontSize:13,color:"var(--text2)" }}>{b.reason||"—"}</td>
                    <td>
                      <button className="btn btn-xs btn-danger" onClick={async()=>{ await apiClient.delete(`/hr/bonuses/${b.id}`); fetchBonuses(); }}>
                        <Icon name="trash" size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {bonuses.length===0 && (
                  <tr><td colSpan={5} style={{ textAlign:"center",padding:32,color:"var(--text3)" }}>No bonus entries for {month}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════ PENALTIES ══════════════════ */}
      {tab==="penalties" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Penalties & Violations</span>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <MonthSelector />
              <button className="btn btn-primary btn-sm" onClick={()=>setShowPenaltyModal(true)}>
                <Icon name="plus" size={14} />Add Penalty
              </button>
            </div>
          </div>

          {penalties.length > 0 && (
            <div style={{ padding:"12px 20px",borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:13,color:"var(--text3)" }}>Total Deductions: </span>
              <strong style={{ color:"#C62828" }}>- EGP {penalties.reduce((s,p)=>s+p.amount,0).toLocaleString()}</strong>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Reason</th><th>Amount (EGP)</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {penalties.map(p=>(
                  <tr key={p.id}>
                    <td style={{ fontWeight:500 }}>{p.employee}</td>
                    <td style={{ color:"var(--text2)",fontSize:13 }}>{p.reason}</td>
                    <td style={{ color:"var(--danger)",fontWeight:600 }}>-{p.amount.toLocaleString()}</td>
                    <td style={{ fontSize:13 }}>{p.date}</td>
                    <td><Badge status={p.status} /></td>
                  </tr>
                ))}
                {penalties.length===0 && (
                  <tr><td colSpan={5} style={{ textAlign:"center",padding:32,color:"var(--text3)" }}>No penalties for {month}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════ MODALS ══════════════ */}

      {/* Add/Edit Employee */}
      <Modal open={showModal} onClose={()=>setShowModal(false)} title={selectedEmp?"Edit Employee":"Add New Employee"}
        footer={<>
          <button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveEmployee}>{selectedEmp?"Update":"Add Employee"}</button>
        </>}
      >
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Full Name</label><input ref={nameRef} className="form-input" defaultValue={selectedEmp?.name} placeholder="Enter full name" /></div>
            <div className="form-group"><label className="form-label">Employee ID</label><input className="form-input" defaultValue={selectedEmp?.employeeId} placeholder="Auto-generated" disabled /></div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Department</label><select ref={deptRef} className="form-input" defaultValue={selectedEmp?.department}>{DEPARTMENTS.map(d=><option key={d}>{d}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Position</label><input ref={posRef} className="form-input" defaultValue={selectedEmp?.position} placeholder="Job title" /></div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Email</label><input ref={emailRef} className="form-input" type="email" defaultValue={selectedEmp?.email} /></div>
            <div className="form-group"><label className="form-label">Phone</label><input ref={phoneRef} className="form-input" defaultValue={selectedEmp?.phone} /></div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Base Salary (EGP)</label><input ref={salRef} className="form-input" type="number" defaultValue={selectedEmp?.salary} /></div>
            <div className="form-group"><label className="form-label">Join Date</label><input ref={dateRef} className="form-input" type="date" defaultValue={selectedEmp?.joinDate} /></div>
          </div>
        </div>
      </Modal>

      {/* New Leave Request */}
      <Modal open={showLeaveModal} onClose={()=>setShowLeaveModal(false)} title="Submit Leave Request"
        footer={<>
          <button className="btn btn-secondary" onClick={()=>setShowLeaveModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmitLeave}>Submit</button>
        </>}
      >
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          <div className="form-group"><label className="form-label">Employee *</label>
            <select ref={leaveEmpRef} className="form-input">
              <option value="">— Select employee —</option>
              {allEmployees.map(e=><option key={e.id} value={e.name}>{e.name} ({e.department})</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Leave Type *</label>
            <select ref={leaveTypeRef} className="form-input">{LEAVE_TYPES.map(t=><option key={t}>{t}</option>)}</select>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">From Date *</label><input ref={leaveFromRef} className="form-input" type="date" /></div>
            <div className="form-group"><label className="form-label">To Date *</label><input ref={leaveToRef} className="form-input" type="date" /></div>
          </div>
        </div>
      </Modal>

      {/* Leave Manage Modal */}
      {leaveManageModal && (
        <LeaveManageModal leave={leaveManageModal} onClose={()=>setLeaveManageModal(null)} onSubmit={handleLeaveStatus} />
      )}

      {/* Add Penalty */}
      <Modal open={showPenaltyModal} onClose={()=>setShowPenaltyModal(false)} title="Record Penalty / Violation"
        footer={<>
          <button className="btn btn-secondary" onClick={()=>setShowPenaltyModal(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleSubmitPenalty}>Record Penalty</button>
        </>}
      >
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          <div className="form-group"><label className="form-label">Employee *</label>
            <select className="form-input" value={penEmp} onChange={e=>setPenEmp(e.target.value)}>
              <option value="">— Select employee —</option>
              {allEmployees.map(e=><option key={e.id} value={e.name}>{e.name} ({e.department})</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Reason / Violation *</label>
            <input className="form-input" value={penReason} onChange={e=>setPenReason(e.target.value)} placeholder="e.g., Late arrival, Unauthorized absence..." />
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Amount (EGP) *</label>
              <input className="form-input" type="number" min="0" step="10" value={penAmount} onChange={e=>setPenAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="form-group"><label className="form-label">Date *</label>
              <input className="form-input" type="date" value={penDate} onChange={e=>setPenDate(e.target.value)} />
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Overtime Modal */}
      <Modal open={showOvertimeModal} onClose={()=>setShowOvertimeModal(false)} title="Record Overtime Hours"
        footer={<>
          <button className="btn btn-secondary" onClick={()=>setShowOvertimeModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmitOvertime}>Save Overtime</button>
        </>}
      >
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          <div className="form-group"><label className="form-label">Employee *</label>
            <select className="form-input" value={ovEmp?.employeeId||""} onChange={e=>setOvEmp(allEmployees.find(emp=>emp.employeeId===e.target.value)||null)}>
              <option value="">— Select employee —</option>
              {allEmployees.map(e=><option key={e.id} value={e.employeeId}>{e.name} ({e.department})</option>)}
            </select>
          </div>
          {ovEmp && (
            <div style={{ padding:"10px 14px",borderRadius:8,background:"rgba(0,85,165,0.06)",border:"1px solid rgba(0,85,165,0.15)",fontSize:13 }}>
              Base Salary: <strong>EGP {ovEmp.salary?.toLocaleString()}</strong> &nbsp;·&nbsp;
              Rate: <strong>EGP {ovRate && parseFloat(ovRate) > 0 ? parseFloat(ovRate) : overtimeRate}/hr</strong>
              {ovRate && parseFloat(ovRate) > 0 && <span style={{ marginLeft:8,fontSize:11,color:"#F57C00",fontWeight:600 }}>(Custom)</span>}
              {!ovRate && <span style={{ marginLeft:8,fontSize:11,color:"var(--text3)" }}>(Global)</span>}
              {ovHours && parseFloat(ovHours)>0 && (
                <span style={{ marginLeft:12,color:"#2E7D32",fontWeight:600 }}>
                  → Total: EGP {(parseFloat(ovHours)*(ovRate && parseFloat(ovRate)>0 ? parseFloat(ovRate) : overtimeRate)).toLocaleString()}
                </span>
              )}
            </div>
          )}
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Overtime Hours *</label>
              <input className="form-input" type="number" min="0.5" step="0.5" value={ovHours} onChange={e=>setOvHours(e.target.value)} placeholder="e.g., 8.5" />
            </div>
            <div className="form-group"><label className="form-label">Specific Rate/hr <span style={{ fontSize:11,color:"var(--text3)" }}>(Optional)</span></label>
              <input className="form-input" type="number" min="0" step="5" value={ovRate} onChange={e=>setOvRate(e.target.value)} placeholder={`Global: ${overtimeRate}`} />
            </div>
          </div>
          <div className="form-group"><label className="form-label">Month</label>
            <input className="form-input" type="month" value={month} disabled />
          </div>
          <div className="form-group"><label className="form-label">Note (optional)</label>
            <input className="form-input" value={ovNote} onChange={e=>setOvNote(e.target.value)} placeholder="e.g., Weekend project, system maintenance..." />
          </div>
        </div>
      </Modal>

      {/* Add Bonus Modal */}
      <Modal open={showBonusModal} onClose={()=>setShowBonusModal(false)} title="Add Employee Bonus"
        footer={<>
          <button className="btn btn-secondary" onClick={()=>setShowBonusModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmitBonus}>Add Bonus</button>
        </>}
      >
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          <div className="form-group"><label className="form-label">Employee *</label>
            <select className="form-input" value={boEmp?.employeeId||""} onChange={e=>setBoEmp(allEmployees.find(emp=>emp.employeeId===e.target.value)||null)}>
              <option value="">— Select employee —</option>
              {allEmployees.map(e=><option key={e.id} value={e.employeeId}>{e.name} ({e.department})</option>)}
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Amount (EGP) *</label>
              <input className="form-input" type="number" min="0" step="100" value={boAmount} onChange={e=>setBoAmount(e.target.value)} placeholder="e.g., 2000" />
            </div>
            <div className="form-group"><label className="form-label">Month</label>
              <input className="form-input" type="month" value={month} disabled />
            </div>
          </div>
          <div className="form-group"><label className="form-label">Reason</label>
            <input className="form-input" value={boReason} onChange={e=>setBoReason(e.target.value)} placeholder="e.g., Exceptional performance, Ramadan bonus..." />
          </div>
        </div>
      </Modal>

      {/* Overtime Rate Setting */}
      <Modal open={showRateModal} onClose={()=>setShowRateModal(false)} title="⚙️ Overtime Rate Setting"
        footer={<>
          <button className="btn btn-secondary" onClick={()=>setShowRateModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveRate}>Save Rate</button>
        </>}
      >
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          <div style={{ padding:"12px 14px",borderRadius:8,background:"rgba(0,85,165,0.06)",border:"1px solid rgba(0,85,165,0.15)",fontSize:13 }}>
            This rate is used to calculate overtime pay: <strong>Hours × Rate = Total</strong>.
            It applies to all new overtime entries. Existing entries keep their stored rate.
          </div>
          <div className="form-group">
            <label className="form-label">Rate per Hour (EGP) *</label>
            <input className="form-input" type="number" min="1" step="5" value={newRate} onChange={e=>setNewRate(e.target.value)} placeholder="e.g., 75" />
          </div>
        </div>
      </Modal>

      {/* Excel Import Modal */}
      {showImportModal && (
        <ExcelImportModal onClose={()=>setShowImportModal(false)} onImported={()=>{ setShowImportModal(false); fetchEmployees(); }} />
      )}

      {/* Bulk Account Results */}
      {showBulkResultModal && bulkResults && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
          <div style={{ background:"var(--surface)",borderRadius:12,padding:24,width:"100%",maxWidth:520,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontWeight:700,fontSize:18,marginBottom:16 }}>🔑 Bulk Account Creation Results</div>
            <div style={{ padding:"12px 16px",borderRadius:8,marginBottom:16,
              background:bulkResults.created>0?"rgba(46,125,50,0.08)":"rgba(198,40,40,0.08)",
              border:`1px solid ${bulkResults.created>0?"rgba(46,125,50,0.2)":"rgba(198,40,40,0.2)"}`,
              color:bulkResults.created>0?"#2E7D32":"#C62828",fontSize:14,fontWeight:600 }}>
              {bulkResults.message}
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:6,maxHeight:300,overflowY:"auto" }}>
              {bulkResults.details?.map((d:any,i:number)=>(
                <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderRadius:6,
                  background:d.status==='created'?"rgba(46,125,50,0.06)":"rgba(198,40,40,0.06)" }}>
                  <div>
                    <div style={{ fontWeight:500,fontSize:13 }}>{d.name}</div>
                    <div style={{ fontSize:11,color:"var(--text3)" }}>{d.email}</div>
                  </div>
                  <span style={{ fontSize:12,fontWeight:600,color:d.status==='created'?"#2E7D32":"#C62828" }}>
                    {d.status==='created'?'✅ Created + Email Sent':'❌ Failed'}
                  </span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop:16,width:"100%" }} onClick={()=>setShowBulkResultModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Set Login Modal */}
      {loginEmp && (
        <SetLoginModal emp={loginEmp} onClose={()=>{ setShowLoginModal(false); setLoginEmp(null); }} open={showLoginModal} />
      )}

      {/* Employee Tax & Insurance Modal */}
      {showEmpTaxModal && empTaxTarget && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
          <div style={{ background:"var(--surface)",borderRadius:12,padding:24,width:"100%",maxWidth:520,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontWeight:700,fontSize:18,marginBottom:4 }}>💰 Tax & Insurance — {empTaxTarget.name}</div>
            <div style={{ fontSize:13,color:"var(--text2)",marginBottom:16 }}>
              {empTaxTarget.employeeId} · {empTaxTarget.department}
            </div>

            {empTaxLoading ? <div style={{ padding:20,textAlign:"center",color:"var(--text3)" }}>Loading...</div> : (
              <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
                {/* Toggle: Use Global vs Custom */}
                <div style={{ display:"flex",gap:8 }}>
                  <button onClick={()=>setEmpTaxUseGlobal(true)} style={{
                    flex:1,padding:"10px 0",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13,border:"2px solid",
                    borderColor:empTaxUseGlobal?"#0055A5":"var(--border)",
                    background:empTaxUseGlobal?"rgba(0,85,165,0.1)":"transparent",
                    color:empTaxUseGlobal?"#0055A5":"var(--text2)",
                  }}>🌍 Use Global Rates</button>
                  <button onClick={()=>setEmpTaxUseGlobal(false)} style={{
                    flex:1,padding:"10px 0",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13,border:"2px solid",
                    borderColor:!empTaxUseGlobal?"#F57C00":"var(--border)",
                    background:!empTaxUseGlobal?"rgba(245,124,0,0.1)":"transparent",
                    color:!empTaxUseGlobal?"#F57C00":"var(--text2)",
                  }}>⚙️ Custom Rates</button>
                </div>

                {empTaxUseGlobal && (
                  <div style={{ padding:"12px 14px",borderRadius:8,background:"rgba(0,85,165,0.06)",border:"1px solid rgba(0,85,165,0.15)",fontSize:13 }}>
                    This employee will use the <strong>global payroll tax settings</strong>. You can customize global rates in System Settings.
                  </div>
                )}

                {!empTaxUseGlobal && (
                  <>
                    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                      {empTaxes.map((t, i) => (
                        <div key={i} style={{ display:"flex",gap:8,alignItems:"center" }}>
                          <input className="form-input" style={{ flex:2 }} value={t.name}
                            onChange={e => { const arr=[...empTaxes]; arr[i]={...arr[i],name:e.target.value}; setEmpTaxes(arr); }}
                            placeholder="e.g., Income Tax" />
                          <div style={{ display:"flex",alignItems:"center",gap:4,flex:1 }}>
                            <input className="form-input" type="number" min="0" max="100" step="0.5" style={{ width:80 }}
                              value={t.rate}
                              onChange={e => { const arr=[...empTaxes]; arr[i]={...arr[i],rate:parseFloat(e.target.value)||0}; setEmpTaxes(arr); }} />
                            <span style={{ fontSize:13,color:"var(--text3)" }}>%</span>
                          </div>
                          <button onClick={() => setEmpTaxes(empTaxes.filter((_,j)=>j!==i))}
                            style={{ background:"rgba(198,40,40,0.1)",color:"#C62828",border:"1px solid rgba(198,40,40,0.2)",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontSize:12 }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>setEmpTaxes([...empTaxes,{name:"",rate:0}])}
                      style={{ alignSelf:"flex-start",background:"rgba(0,85,165,0.08)",color:"#0055A5",border:"1px solid rgba(0,85,165,0.2)",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:13,fontWeight:600 }}>
                      + Add Field
                    </button>
                  </>
                )}

                <div style={{ display:"flex",gap:8,marginTop:8 }}>
                  <button className="btn btn-secondary" style={{ flex:1 }} onClick={()=>setShowEmpTaxModal(false)}>Cancel</button>
                  <button className="btn btn-primary" style={{ flex:2 }} onClick={handleSaveEmpTaxes}>
                    💾 Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Leave Manage Modal ───────────────────────────────────────────────────────

function LeaveManageModal({ leave, onClose, onSubmit }: { leave: any; onClose: ()=>void; onSubmit: (id: number, status: string, hr_note?: string)=>void }) {
  const [hr_note, setHrNote]         = useState(leave.hr_note || "");
  const [selectedStatus, setSelected] = useState(leave.status);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
      <div style={{ background:"var(--surface)",borderRadius:12,padding:24,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontWeight:700,fontSize:18,marginBottom:4 }}>✏️ Manage Leave Request</div>
        <div style={{ fontSize:13,color:"var(--text2)",marginBottom:16 }}>
          <strong>{leave.employee}</strong> · {leave.type} · {leave.from_date} → {leave.to_date} ({leave.days} days)
        </div>

        {/* Employee note (read-only) */}
        {leave.note && (
          <div style={{ padding:"10px 14px",borderRadius:8,background:"rgba(0,0,0,0.04)",border:"1px solid var(--border)",marginBottom:16,fontSize:13 }}>
            <div style={{ fontSize:11,fontWeight:600,color:"var(--text3)",marginBottom:4,textTransform:"uppercase" }}>Employee's Note:</div>
            <div style={{ color:"var(--text)" }}>{leave.note}</div>
          </div>
        )}

        {/* Status selector */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12,fontWeight:600,color:"var(--text3)",marginBottom:8,textTransform:"uppercase" }}>Decision</div>
          <div style={{ display:"flex",gap:8 }}>
            {["Pending","Approved","Rejected"].map(s=>(
              <button key={s} onClick={()=>setSelected(s)} style={{
                flex:1,padding:"10px 0",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13,border:"2px solid",
                borderColor:selectedStatus===s?(s==="Approved"?"#2E7D32":s==="Rejected"?"#C62828":"#F57C00"):"var(--border)",
                background:selectedStatus===s?(s==="Approved"?"rgba(46,125,50,0.1)":s==="Rejected"?"rgba(198,40,40,0.1)":"rgba(245,124,0,0.1)"):"transparent",
                color:selectedStatus===s?(s==="Approved"?"#2E7D32":s==="Rejected"?"#C62828":"#F57C00"):"var(--text2)",
              }}>
                {s==="Approved"?"✅":s==="Rejected"?"❌":"⏳"} {s}
              </button>
            ))}
          </div>
        </div>

        {/* HR Note (visible to employee via email + dashboard) */}
        <div className="form-group" style={{ marginBottom:20 }}>
          <label className="form-label">HR Note <span style={{ fontSize:11,color:"var(--text3)" }}>(sent to employee via email & shown in their dashboard)</span></label>
          <textarea className="form-input" value={hr_note} onChange={e=>setHrNote(e.target.value)}
            placeholder="Add a note for the employee... e.g., Please provide medical certificate" rows={3} style={{ resize:"vertical" }} />
        </div>

        <div style={{ display:"flex",gap:8 }}>
          <button className="btn btn-secondary" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex:2 }} onClick={()=>onSubmit(leave.id,selectedStatus,hr_note)}>
            💾 Save & Notify Employee
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Excel/CSV Import Modal ───────────────────────────────────────────────────

function ExcelImportModal({ onClose, onImported }: { onClose: ()=>void; onImported: ()=>void }) {
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  const [preview, setPreview]     = useState<any[]>([]);
  const [parsed, setParsed]       = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv') { toast("Please use CSV format. Save your Excel file as CSV first.","error"); return; }
    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) { toast("File is empty or has no data rows","error"); return; }
    const headers = lines[0].split(',').map(h=>h.trim().replace(/["']/g,'').toLowerCase());
    const rows = lines.slice(1).map(line=>{
      const cols = line.split(',').map(c=>c.trim().replace(/["']/g,''));
      const obj: any = {};
      headers.forEach((h,i)=>{ obj[h]=cols[i]||''; });
      return obj;
    }).filter(r=>r.name||r['full name']);

    const mapped = rows.map(r=>({
      name:     r.name||r['full name']||r['fullname']||'',
      department: r.department||r.dept||'',
      position:   r.position||r['job title']||r.title||'',
      salary:     r.salary||r['base salary']||'',
      email:      r.email||'',
      phone:      r.phone||r.mobile||'',
      joinDate:   r.joindate||r['join date']||r['join_date']||'',
      status:     r.status||'Active',
    }));

    setParsedData(mapped);
    setPreview(mapped.slice(0,5));
    setParsed(true);
  };

  const handleImport = async () => {
    if (!parsedData.length) { toast("No data to import","error"); return; }
    setImporting(true);
    try {
      const result = await apiClient.post<any>('/hr/employees/bulk-import',{ employees: parsedData });
      toast(result.message||"Import complete","success");
      onImported();
    } catch (e: any) { toast(e.message||"Import failed","error"); }
    finally { setImporting(false); }
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
      <div style={{ background:"var(--surface)",borderRadius:12,padding:24,width:"100%",maxWidth:580,boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontWeight:700,fontSize:18,marginBottom:4 }}>📂 Import Employees from CSV</div>
        <div style={{ fontSize:13,color:"var(--text2)",marginBottom:16 }}>
          Required columns: <strong>name, department, position</strong>. Optional: salary, email, phone, joinDate, status.
        </div>

        <div style={{ padding:"10px 14px",borderRadius:8,background:"rgba(0,85,165,0.06)",border:"1px solid rgba(0,85,165,0.15)",marginBottom:16,fontSize:12,color:"#0055A5",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <code style={{ fontSize:11 }}>name,department,position,salary,email,phone,joinDate,status</code>
          <button style={{ fontSize:11,padding:"2px 10px",borderRadius:4,cursor:"pointer",background:"rgba(0,85,165,0.1)",border:"1px solid rgba(0,85,165,0.3)",color:"#0055A5" }}
            onClick={()=>{
              const csv = `name,department,position,salary,email,phone,joinDate,status\nAhmed Mohamed,HR,Specialist,12000,ahmed@company.com,01012345678,2024-01-15,Active\nFatma Ali,IT,Engineer,15000,fatma@company.com,01098765432,2024-02-01,Active`;
              const blob = new Blob([csv],{ type:'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href=url; a.download='employees_template.csv'; a.click();
            }}>
            ⬇️ Template
          </button>
        </div>

        <div style={{ border:"2px dashed var(--border)",borderRadius:10,padding:32,textAlign:"center",cursor:"pointer",marginBottom:16 }}
          onClick={()=>fileRef.current?.click()}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f)handleFile(f); }}>
          <div style={{ fontSize:36,marginBottom:8 }}>📄</div>
          <div style={{ fontWeight:600,marginBottom:4 }}>Drop CSV file here or click to browse</div>
          <div style={{ fontSize:12,color:"var(--text3)" }}>.csv format only</div>
          <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={e=>{ if(e.target.files?.[0])handleFile(e.target.files[0]); }} />
        </div>

        {parsed && preview.length>0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600,fontSize:13,marginBottom:8 }}>Preview — {parsedData.length} rows found:</div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",fontSize:12,borderCollapse:"collapse" }}>
                <thead><tr>{["Name","Dept","Position","Salary","Email"].map(h=><th key={h} style={{ padding:"6px 8px",textAlign:"left",background:"var(--surface2)",borderBottom:"1px solid var(--border)" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {preview.map((r,i)=>(
                    <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                      <td style={{ padding:"6px 8px" }}>{r.name||<span style={{ color:"#C62828" }}>⚠️ Missing</span>}</td>
                      <td style={{ padding:"6px 8px" }}>{r.department||"—"}</td>
                      <td style={{ padding:"6px 8px" }}>{r.position||"—"}</td>
                      <td style={{ padding:"6px 8px" }}>{r.salary||"8000"}</td>
                      <td style={{ padding:"6px 8px" }}>{r.email||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display:"flex",gap:8 }}>
          <button className="btn btn-secondary" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex:2 }} onClick={handleImport} disabled={!parsed||importing}>
            {importing?"Importing...":parsed?`📥 Import ${parsedData.length} Employees`:"Select a file first"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Set Login Modal ──────────────────────────────────────────────────────────

function SetLoginModal({ emp, open, onClose }: { emp: any; open: boolean; onClose: ()=>void }) {
  const toast = useToast();
  const [username, setUsername] = useState(emp.email||`${emp.employeeId?.toLowerCase()}@school.edu.eg`);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [existing, setExisting] = useState<any>(null);
  const [checkLoading, setCheckLoading] = useState(true);
  const [showPwd, setShowPwd]   = useState(false);

  useEffect(() => {
    if (!open) return;
    setCheckLoading(true);
    apiClient.get<any>(`/auth/employee-account/${emp.employeeId}`)
      .then(d=>setExisting(d.account)).catch(()=>setExisting(null)).finally(()=>setCheckLoading(false));
  }, [open, emp.employeeId]);

  const handleSave = async () => {
    if (!username.trim())     { toast("Email required","error"); return; }
    if (password.length < 6)  { toast("Password min 6 chars","error"); return; }
    if (password !== confirm) { toast("Passwords don't match","error"); return; }
    setLoading(true);
    try {
      await apiClient.post("/auth/employee-account",{ employeeId: emp.employeeId, username: username.trim(), password });
      toast(`✅ Login ${existing?"updated":"created"} for ${emp.name}`,"success"); onClose();
    } catch (e: any) { toast(e.message||"Failed","error"); }
    finally { setLoading(false); }
  };

  if (!open) return null;
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
      <div style={{ background:"var(--surface)",borderRadius:12,padding:24,width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}>
          <div style={{ fontSize:28 }}>🔑</div>
          <div>
            <div style={{ fontWeight:700,fontSize:16 }}>{existing?"Reset Login":"Create Login"} — {emp.name}</div>
            <div style={{ fontSize:12,color:"var(--text3)" }}>{emp.employeeId} · {emp.department}</div>
          </div>
        </div>
        {checkLoading ? <div style={{ padding:12,color:"var(--text3)",fontSize:13 }}>Checking account status...</div> : (
          <div style={{ padding:10,borderRadius:8,marginBottom:16,fontSize:13,
            background:existing?"rgba(46,125,50,0.08)":"rgba(245,124,0,0.08)",
            border:`1px solid ${existing?"rgba(46,125,50,0.2)":"rgba(245,124,0,0.2)"}`,
            color:existing?"#2E7D32":"#F57C00" }}>
            {existing?`✅ Account: ${existing.email} — will reset password`:"⚠️ No account yet — will create new login"}
          </div>
        )}
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div className="form-group"><label className="form-label">Username (Email) *</label>
            <input className="form-input" type="email" value={username} onChange={e=>setUsername(e.target.value)} />
          </div>
          <div className="form-group"><label className="form-label">Password *</label>
            <div style={{ position:"relative" }}>
              <input className="form-input" type={showPwd?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 6 characters" style={{ paddingRight:40 }} />
              <button onClick={()=>setShowPwd(!showPwd)} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:14,color:"var(--text3)" }}>
                {showPwd?"🙈":"👁️"}
              </button>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Confirm Password *</label>
            <input className="form-input" type={showPwd?"text":"password"} value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSave()} />
            {confirm&&password!==confirm&&<div style={{ fontSize:11,color:"#C62828",marginTop:4 }}>❌ Passwords don't match</div>}
            {confirm&&password===confirm&&confirm.length>=6&&<div style={{ fontSize:11,color:"#2E7D32",marginTop:4 }}>✅ Passwords match</div>}
          </div>
          <div style={{ display:"flex",gap:8,marginTop:4 }}>
            <button className="btn btn-secondary" onClick={onClose} style={{ flex:1 }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading} style={{ flex:2 }}>
              {loading?"Saving...":existing?"🔄 Reset Password":"✅ Create Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
