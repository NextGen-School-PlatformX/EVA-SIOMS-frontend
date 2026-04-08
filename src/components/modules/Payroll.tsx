"use client";

import { useState, useEffect } from "react";
import { KPICard, SearchBar, Pagination, Badge, Modal } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { Icon } from "@/components/ui/Icon";
import { apiClient } from "@/services/apiClient";
import type { PayrollRecord } from "@/types";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function monthLabel(m: string) {
  if (!m) return m;
  const [year, mon] = m.split('-');
  const d = new Date(parseInt(year), parseInt(mon)-1, 1);
  return d.toLocaleDateString('en-EG', { month: 'long', year: 'numeric' });
}

export default function Payroll() {
  const toast = useToast();
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(1);
  const [data, setData]             = useState<PayrollRecord[]>([]);
  const [summary, setSummary]       = useState<any>(null);
  const [total, setTotal]           = useState(0);
  const [payslipEmp, setPayslipEmp] = useState<PayrollRecord | null>(null);
  const [loading, setLoading]       = useState(true);
  const [month, setMonth]           = useState(currentMonth());
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const perPage = 20;

  const fetchMonths = async () => {
    try {
      const months = await apiClient.get<string[]>('/payroll/months');
      const all = Array.from(new Set([currentMonth(), ...months])).sort().reverse();
      setAvailableMonths(all);
    } catch {}
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [res, sum] = await Promise.all([
        apiClient.get<any>(`/payroll?search=${search}&page=${page}&limit=${perPage}&month=${month}`),
        apiClient.get<any>(`/payroll/summary?month=${month}`),
      ]);
      setData(res.data); setTotal(res.total); setSummary(sum);
    } catch { toast("Failed to load payroll","error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMonths(); }, []);
  useEffect(() => { fetchData(); }, [search, page, month]);

  const handleProcessAll = async () => {
    if (!confirm(`Process payroll for all employees for ${monthLabel(month)}?`)) return;
    try {
      await apiClient.post('/payroll/bulk/pay-all',{ month });
      toast("All payroll processed!","success"); fetchData();
    } catch { toast("Failed to process","error"); }
  };

  const handlePay = async (emp: PayrollRecord) => {
    if (!confirm(`Mark ${emp.employeeName} as Paid for ${monthLabel(month)}?`)) return;
    try {
      await apiClient.post(`/payroll/${emp.employeeId}/pay`,{ month });
      toast("Marked as paid","success"); fetchData();
    } catch { toast("Failed","error"); }
  };

  const handleExport = () => {
    const csv = [
      ['Employee ID','Employee Name','Department','Base Salary','Overtime','Bonus','Penalties','Tax','Insurance','Net Salary','Status'],
      ...data.map(p=>[
        p.employeeId, p.employeeName, p.department,
        p.baseSalary, p.overtime, p.bonus, p.penalties,
        p.taxDeduction, p.insuranceDeduction, p.netSalary, p.status,
      ])
    ].map(row=>row.map(c=>`"${c}"`).join(',')).join('\n');

    const blob = new Blob([csv],{ type:'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href  = URL.createObjectURL(blob);
    link.download = `payroll-${month}.csv`;
    link.click();
    toast('Payroll exported!','success');
  };

  const printPayslip = (p: PayrollRecord) => {
    const w = window.open('','_blank');
    if (!w) { toast("Allow popups to print","error"); return; }
    // Build deduction rows dynamically
    let deductionRows = `<div class="row"><span>Penalties / Violations</span><span class="neg">- EGP ${p.penalties.toLocaleString()}</span></div>`;
    if (p.customDeductions && p.customDeductions.length > 0) {
      deductionRows += p.customDeductions.map(d =>
        `<div class="row"><span>${d.name} (${d.rate}%)</span><span class="neg">- EGP ${d.amount.toLocaleString()}</span></div>`
      ).join('');
    } else {
      deductionRows += `<div class="row"><span>Income Tax</span><span class="neg">- EGP ${p.taxDeduction.toLocaleString()}</span></div>`;
      deductionRows += `<div class="row"><span>Insurance</span><span class="neg">- EGP ${p.insuranceDeduction.toLocaleString()}</span></div>`;
    }
    w.document.write(`<!DOCTYPE html><html><head><title>Payslip - ${p.employeeName} - ${p.month}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;color:#333;padding:20px}
  h1{color:#0055A5;border-bottom:3px solid #0055A5;padding-bottom:12px;margin-bottom:20px}
  .header{background:#f5f8ff;padding:16px;border-radius:8px;margin-bottom:24px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
  .row.total{font-size:18px;font-weight:700;color:#0055A5;border-top:3px solid #0055A5;border-bottom:none;margin-top:8px;padding-top:16px}
  .pos{color:#2E7D32}.neg{color:#C62828}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;
    background:${p.status==='Paid'?'rgba(46,125,50,0.1)':'rgba(245,124,0,0.1)'};
    color:${p.status==='Paid'?'#2E7D32':'#F57C00'}}
  @media print{button{display:none}}
</style></head><body>
<h1>SIOMS Payslip</h1>
<div class="header">
  <strong style="font-size:18px">${p.employeeName}</strong><br>
  <span style="color:#666;font-size:13px">${p.employeeId} &nbsp;·&nbsp; ${p.department}</span><br>
  <span style="color:#666;font-size:13px">Month: <strong>${monthLabel(p.month)}</strong> &nbsp;·&nbsp; Status: <span class="badge">${p.status}</span></span>
</div>
<div class="row"><span>Base Salary</span><span class="pos">EGP ${p.baseSalary.toLocaleString()}</span></div>
<div class="row"><span>Overtime</span><span class="pos">+ EGP ${p.overtime.toLocaleString()}</span></div>
<div class="row"><span>Bonus</span><span class="pos">+ EGP ${p.bonus.toLocaleString()}</span></div>
${deductionRows}
<div class="row total"><span>Net Salary</span><span>EGP ${p.netSalary.toLocaleString()}</span></div>
<br><p style="color:#888;font-size:12px;text-align:center">Generated by SIOMS · ${new Date().toLocaleDateString()}</p>
<button onclick="window.print()" style="margin-top:20px;padding:10px 24px;background:#0055A5;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">🖨️ Print / Save as PDF</button>
</body></html>`);
    w.document.close();
    setTimeout(()=>w.print(), 400);
  };

  const gross = data.reduce((s,p)=>s+p.baseSalary+p.overtime+p.bonus,0);
  const totalDeductions = data.reduce((s,p)=>s+p.penalties+p.taxDeduction+p.insuranceDeduction,0);

  return (
    <div className="fade-in">
      {/* KPI Row */}
      <div className="kpi-grid" style={{ gridTemplateColumns:"repeat(4,1fr)" }}>
        <KPICard icon="payroll"  label="Net Payroll"   value={`EGP ${((summary?.totalPayroll||0)/1000).toFixed(1)}K`} color="#0055A5" bg="rgba(0,85,165,0.1)" />
        <KPICard icon="users"    label="Employees"     value={summary?.totalEmployees??'—'}                           color="#2E7D32" bg="rgba(46,125,50,0.1)" />
        <KPICard icon="check"    label="Paid"          value={summary?.paid??'—'}                                     color="#2E7D32" bg="rgba(46,125,50,0.1)" />
        <KPICard icon="alert"    label="Pending"       value={summary?.pending??'—'}                                  color="#C62828" bg="rgba(198,40,40,0.1)" />
      </div>

      {/* Payroll Breakdown Cards */}
      {data.length > 0 && (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12 }}>
          {[
            { label:"Gross Salary",      value:`EGP ${gross.toLocaleString()}`,          color:"#0055A5", sub:"Base + Overtime + Bonus" },
            { label:"Total Deductions",  value:`- EGP ${totalDeductions.toLocaleString()}`, color:"#C62828", sub:"Penalties + Tax + Insurance" },
            { label:"Total Net Payout",  value:`EGP ${(summary?.totalPayroll||0).toLocaleString()}`, color:"#2E7D32", sub:"After all deductions" },
          ].map(c=>(
            <div key={c.label} className="card" style={{ padding:"14px 18px" }}>
              <div style={{ fontSize:12,color:"var(--text3)",marginBottom:4 }}>{c.label}</div>
              <div style={{ fontSize:20,fontWeight:700,color:c.color }}>{c.value}</div>
              <div style={{ fontSize:11,color:"var(--text3)",marginTop:2 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <span className="card-title">{monthLabel(month)} Payroll</span>
            {/* Month Selector */}
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <select
                className="form-input"
                value={month}
                onChange={e=>{ setMonth(e.target.value); setPage(1); }}
                style={{ padding:"4px 10px",fontSize:13,width:180 }}
              >
                {availableMonths.map(m=>(
                  <option key={m} value={m}>{monthLabel(m)}{m===currentMonth()?" (Current)":""}</option>
                ))}
              </select>
              <button className="btn btn-secondary btn-sm" onClick={()=>{ const m=currentMonth(); setMonth(m); }} title="Go to current month">
                Today
              </button>
            </div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button className="btn btn-success btn-sm" onClick={handleProcessAll}>✅ Pay All Pending</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Icon name="download" size={14} />Export CSV</button>
          </div>
        </div>
        <div className="filter-bar">
          <SearchBar value={search} onChange={v=>{setSearch(v);setPage(1);}} placeholder="Search employee..." />
        </div>

        {loading ? <div style={{ padding:40,textAlign:'center',color:'var(--text3)' }}>Loading...</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Base Salary</th>
                  <th style={{ color:"#2E7D32" }}>+ Overtime</th>
                  <th style={{ color:"#2E7D32" }}>+ Bonus</th>
                  <th style={{ color:"#C62828" }}>- Penalties</th>
                  <th style={{ color:"#C62828" }}>- Tax & Ins</th>
                  <th style={{ color:"#0055A5",fontWeight:700 }}>Net Salary</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map(p=>(
                  <tr key={p.employeeId}>
                    <td>
                      <div>
                        <div style={{ fontWeight:500 }}>{p.employeeName}</div>
                        <div style={{ fontSize:11,color:"var(--text3)" }}>{p.department} · {p.employeeId}</div>
                      </div>
                    </td>
                    <td>EGP {p.baseSalary.toLocaleString()}</td>
                    <td style={{ color:"#2E7D32" }}>
                      {p.overtime>0 ? `+${p.overtime.toLocaleString()}` : <span style={{ color:"var(--text3)" }}>—</span>}
                    </td>
                    <td style={{ color:"#2E7D32" }}>
                      {p.bonus>0 ? `+${p.bonus.toLocaleString()}` : <span style={{ color:"var(--text3)" }}>—</span>}
                    </td>
                    <td style={{ color:"#C62828" }}>
                      {p.penalties>0 ? `-${p.penalties.toLocaleString()}` : <span style={{ color:"var(--text3)" }}>—</span>}
                    </td>
                    <td style={{ color:"#C62828",fontSize:12 }}>
                      <span title={p.customDeductions?.map((d:any)=>`${d.name}: ${d.rate}% = EGP ${d.amount?.toLocaleString()}`).join('\n') || ''} style={{ cursor:"help",borderBottom:"1px dashed #C62828" }}>
                        -{(p.customDeductions?.reduce((s:number,d:any)=>s+(d.amount||0),0) || (p.taxDeduction+p.insuranceDeduction)).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ fontWeight:700,color:"#0055A5",fontSize:15 }}>
                      EGP {p.netSalary.toLocaleString()}
                    </td>
                    <td><Badge status={p.status} /></td>
                    <td>
                      <div style={{ display:"flex",gap:6 }}>
                        <button className="btn btn-xs btn-secondary" onClick={()=>setPayslipEmp(p)} title="View payslip">
                          <Icon name="eye" size={12} />
                        </button>
                        <button className="btn btn-xs btn-secondary" onClick={()=>printPayslip(p)} title="Print/PDF">
                          🖨️
                        </button>
                        {p.status==='Pending' && (
                          <button className="btn btn-xs btn-success" onClick={()=>handlePay(p)}>Pay</button>
                        )}
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

      {/* Payslip Modal */}
      <Modal open={!!payslipEmp} onClose={()=>setPayslipEmp(null)} title="Payslip Preview"
        footer={<>
          <button className="btn btn-secondary" onClick={()=>setPayslipEmp(null)}>Close</button>
          <button className="btn btn-primary" onClick={()=>{ if(payslipEmp) printPayslip(payslipEmp); }}>
            <Icon name="download" size={14} />Print / Download PDF
          </button>
        </>}
      >
        {payslipEmp && (
          <div>
            <div style={{ textAlign:"center",marginBottom:20,padding:"12px 0",borderBottom:"2px solid var(--primary)" }}>
              <div style={{ fontFamily:"Sora,sans-serif",fontWeight:700,fontSize:22,color:"var(--primary)" }}>SIOMS Payslip</div>
              <div style={{ color:"var(--text3)",fontSize:13 }}>School Internal Operations Management System</div>
              <div style={{ marginTop:6,fontSize:13,color:"var(--text2)" }}>{monthLabel(payslipEmp.month)}</div>
            </div>
            <div style={{ marginBottom:20,background:"var(--surface2)",borderRadius:8,padding:14 }}>
              <div style={{ fontWeight:600,fontSize:15 }}>{payslipEmp.employeeName}</div>
              <div style={{ fontSize:13,color:"var(--text2)",marginTop:2 }}>{payslipEmp.department} · {payslipEmp.employeeId}</div>
            </div>

            {/* Earnings */}
            <div style={{ fontSize:11,fontWeight:600,color:"var(--text3)",marginBottom:8,textTransform:"uppercase",letterSpacing:1 }}>Earnings</div>
            {[
              ["Base Salary",          payslipEmp.baseSalary, "+", "var(--text)"],
              ["Overtime",             payslipEmp.overtime,   "+", "#2E7D32"],
              ["Bonus",                payslipEmp.bonus,      "+", "#2E7D32"],
            ].map(([label,val,sign,color])=>(
              <div key={label as string} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)" }}>
                <span style={{ fontSize:14,color:"var(--text2)" }}>{label as string}</span>
                <span style={{ fontWeight:500,color: color as string }}>
                  {(val as number)>0 ? `${sign} EGP ${(val as number).toLocaleString()}` : <span style={{ color:"var(--text3)" }}>—</span>}
                </span>
              </div>
            ))}

            {/* Deductions */}
            <div style={{ fontSize:11,fontWeight:600,color:"var(--text3)",marginBottom:8,marginTop:16,textTransform:"uppercase",letterSpacing:1 }}>Deductions</div>
            {/* Penalties */}
            <div style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:14,color:"var(--text2)" }}>Penalties</span>
              <span style={{ fontWeight:500,color:"#C62828" }}>
                {payslipEmp.penalties > 0 ? `- EGP ${payslipEmp.penalties.toLocaleString()}` : <span style={{ color:"var(--text3)" }}>—</span>}
              </span>
            </div>
            {/* Dynamic Tax & Insurance Deductions */}
            {(payslipEmp.customDeductions && payslipEmp.customDeductions.length > 0) ? (
              payslipEmp.customDeductions.map((d: any, i: number) => (
                <div key={i} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontSize:14,color:"var(--text2)" }}>{d.name} ({d.rate}%)</span>
                  <span style={{ fontWeight:500,color:"#C62828" }}>
                    {d.amount > 0 ? `- EGP ${d.amount.toLocaleString()}` : <span style={{ color:"var(--text3)" }}>—</span>}
                  </span>
                </div>
              ))
            ) : (
              <>
                <div style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontSize:14,color:"var(--text2)" }}>Income Tax</span>
                  <span style={{ fontWeight:500,color:"#C62828" }}>
                    {payslipEmp.taxDeduction > 0 ? `- EGP ${payslipEmp.taxDeduction.toLocaleString()}` : <span style={{ color:"var(--text3)" }}>—</span>}
                  </span>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontSize:14,color:"var(--text2)" }}>Insurance</span>
                  <span style={{ fontWeight:500,color:"#C62828" }}>
                    {payslipEmp.insuranceDeduction > 0 ? `- EGP ${payslipEmp.insuranceDeduction.toLocaleString()}` : <span style={{ color:"var(--text3)" }}>—</span>}
                  </span>
                </div>
              </>
            )}

            {/* Net */}
            <div style={{ display:"flex",justifyContent:"space-between",padding:"16px 0",marginTop:8,borderTop:"2px solid var(--primary)" }}>
              <span style={{ fontWeight:700,fontSize:16,fontFamily:"Sora,sans-serif" }}>Net Salary</span>
              <span style={{ fontWeight:700,fontSize:20,color:"var(--primary)",fontFamily:"Sora,sans-serif" }}>
                EGP {payslipEmp.netSalary.toLocaleString()}
              </span>
            </div>
            <div style={{ textAlign:"center",marginTop:8 }}>
              <Badge status={payslipEmp.status} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
