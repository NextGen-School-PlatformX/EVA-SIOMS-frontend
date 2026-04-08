"use client";

/**
 * EmployeeDashboard.tsx
 * - Real QR codes using qrcode.react (scannable by any QR app)
 * - Camera scan via jsqr
 * - Check-out time enforcement (day closes after checkout_time)
 * - No Attendance page for employees (dashboard only)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "@/services/apiClient";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/context/AuthContext";
// @ts-ignore
import { QRCodeSVG } from "qrcode.react";

interface TodayData {
  settings: { check_in_open: string; late_after: string; check_out_time: string };
  today: string;
  record: { id: number; checkIn: string | null; checkOut: string | null; status: string; checkInMethod: string; } | null;
  employeeId: string; name: string; department: string;
}

// ─── Camera QR Scanner ────────────────────────────────────────────────────────

function CameraScanner({ onScan, onClose }: { onScan: (data: string) => void; onClose: () => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef   = useRef<number>(0);
  const [jsQR, setJsQR]         = useState<any>(null);
  const [status, setStatus]     = useState<"loading" | "scanning" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    import("jsqr").then((m) => setJsQR(() => m.default)).catch(() => {
      setErrorMsg("jsQR not available. Run: npm install jsqr in the frontend folder.");
      setStatus("error");
    });
  }, []);

  const startCamera = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      // Stop existing stream first
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("scanning");
      }
    } catch (e: any) {
      setErrorMsg(e.name === "NotAllowedError"
        ? "Camera permission denied. Please allow camera access in your browser settings."
        : "Cannot access camera. Make sure no other app is using it.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (jsQR) startCamera();
    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [jsQR]);

  useEffect(() => {
    if (status !== "scanning" || !jsQR) return;
    const scan = () => {
      const video = videoRef.current, canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d")!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          cancelAnimationFrame(animRef.current);
          streamRef.current?.getTracks().forEach(t => t.stop());
          onScan(code.data);
          return;
        }
      }
      animRef.current = requestAnimationFrame(scan);
    };
    animRef.current = requestAnimationFrame(scan);
    return () => cancelAnimationFrame(animRef.current);
  }, [status, jsQR, onScan]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>📷 Scan QR Code</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
        </div>

        {status === "loading" && (
          <div style={{ textAlign: "center", padding: 50, color: "var(--text3)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
            <div>Initializing camera...</div>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: "#C62828", fontWeight: 600, marginBottom: 16, fontSize: 14 }}>{errorMsg}</div>
            <button className="btn btn-primary" onClick={startCamera}>🔄 Try Again</button>
          </div>
        )}

        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", display: status === "scanning" ? "block" : "none" }}>
          <video ref={videoRef} style={{ width: "100%", display: "block", borderRadius: 10 }} playsInline muted />
          {/* Scanning frame overlay */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ width: "65%", aspectRatio: "1", border: "3px solid #0055A5", borderRadius: 12, boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }} />
          </div>
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {status === "scanning" && (
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--text2)", textAlign: "center" }}>
            📱 Point camera at the QR code — it scans automatically
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const toast    = useToast();
  const [activeTab, setActiveTab]         = useState<"dashboard"|"leaves"|"payroll"|"assets">("dashboard");
  const [myAssets, setMyAssets]             = useState<any[]>([]);
  const [assetsLoading, setAssetsLoading]   = useState(false);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [actionLoading, setAction] = useState(false);
  const [qrData, setQrData]       = useState<any>(null);
  const [qrLoading, setQrLoad]    = useState(false);
  const [showQr, setShowQr]       = useState(false);
  const [showScan, setShowScan]   = useState(false);
  const [gps, setGps]             = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [now, setNow]             = useState(new Date());

  // Leave Requests
  const [myLeaves, setMyLeaves]             = useState<any[]>([]);
  const [showLeaveForm, setShowLeaveForm]   = useState(false);
  const [leaveType, setLeaveType]           = useState("Annual Leave");
  const [leaveFrom, setLeaveFrom]           = useState("");
  const [leaveTo, setLeaveTo]               = useState("");
  const [leaveReason, setLeaveReason]       = useState("");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  // Payroll
  const [myPayroll, setMyPayroll]           = useState<any>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<TodayData>("/attendance/my-today");
      setTodayData(data);
    } catch (e: any) {
      // Don't show error toast for "not linked" - show friendly message in UI instead
      if (!e.message?.includes("not linked") && !e.message?.includes("not found")) {
        toast(e.message || "Failed to load your attendance", "error");
      }
      setTodayData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchToday(); fetchMyLeaves(); }, [fetchToday]);
  useEffect(() => { if (activeTab === "payroll" && !myPayroll) fetchMyPayroll(); }, [activeTab]);
  useEffect(() => { if (activeTab === "assets") fetchMyAssets(); }, [activeTab]);

  const fetchMyAssets = async () => {
    setAssetsLoading(true);
    try { setMyAssets(await apiClient.get<any[]>('/dashboard/employee/assets')); }
    catch { /* no assets linked */ }
    finally { setAssetsLoading(false); }
  };

  const fetchMyLeaves = useCallback(async () => {
    try {
      const data = await apiClient.get<any[]>("/hr/my-leaves");
      setMyLeaves(data);
    } catch { /* ignore */ }
  }, []);

  const fetchMyPayroll = useCallback(async () => {
    setPayrollLoading(true);
    try {
      const data = await apiClient.get<any>("/payroll/my-payroll");
      setMyPayroll(data);
      if (data.payroll?.length > 0) setSelectedPayrollMonth(data.payroll[0].month);
    } catch (e: any) {
      toast(e.message || "Could not load payroll", "error");
    } finally {
      setPayrollLoading(false);
    }
  }, []);

  const handleSubmitLeave = async () => {
    if (!leaveFrom || !leaveTo) { toast("Please select dates", "error"); return; }
    if (new Date(leaveFrom) > new Date(leaveTo)) { toast("From date cannot be after To date", "error"); return; }
    setLeaveSubmitting(true);
    try {
      await apiClient.post("/hr/my-leaves", { type: leaveType, from_date: leaveFrom, to_date: leaveTo, reason: leaveReason });
      toast("✅ Leave request submitted successfully", "success");
      setShowLeaveForm(false);
      setLeaveFrom(""); setLeaveTo(""); setLeaveReason("");
      fetchMyLeaves();
    } catch (e: any) {
      toast(e.message || "Failed to submit leave", "error");
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const acquireGps = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { setGpsStatus("error"); resolve(null); return; }
      setGpsStatus("loading");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGps(c); setGpsStatus("ok"); resolve(c);
        },
        () => { setGpsStatus("error"); resolve(null); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });

  const loadQr = async () => {
    setQrLoad(true);
    try {
      const data = await apiClient.get<any>("/attendance/my-qr");
      setQrData(data);
      setShowQr(true);
    } catch (e: any) {
      toast(e.message || "Could not load your QR", "error");
    } finally {
      setQrLoad(false);
    }
  };

  const doQrCheckIn = async (rawQrData: string) => {
    if (todayData?.record?.checkIn) { toast("Already checked in!", "error"); return; }
    setAction(true);
    const coords = await acquireGps();
    try {
      const body: any = { qrData: rawQrData };
      if (coords) { body.lat = coords.lat; body.lng = coords.lng; }
      const result = await apiClient.post<any>("/attendance/qr-checkin", body);
      toast(`✅ Checked in at ${result.record.checkIn}!`, "success");
      await fetchToday();
      setShowQr(false);
      setShowScan(false);
    } catch (e: any) {
      toast(e.message || "Check-in failed", "error");
    } finally {
      setAction(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayData?.record?.checkIn) { toast("You haven't checked in yet", "error"); return; }
    if (todayData?.record?.checkOut) { toast("Already checked out", "error"); return; }
    setAction(true);
    try {
      const result = await apiClient.post<any>("/attendance/my-checkout", {});
      toast(`✅ Checked out at ${result.record.checkOut}!`, "success");
      await fetchToday();
    } catch (e: any) {
      toast(e.message || "Check-out failed", "error");
    } finally {
      setAction(false);
    }
  };

  const fmt     = (d: Date) => d.toLocaleTimeString("en-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtDate = (d: Date) => d.toLocaleDateString("en-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const statusColor: Record<string, string> = {
    Present: "#2E7D32", Late: "#F57C00", Absent: "#C62828", Weekend: "#9E9E9E",
  };

  const settings     = todayData?.settings;
  const rec          = todayData?.record;
  const isDone       = !!rec?.checkOut;
  const nowMins      = now.getHours() * 60 + now.getMinutes();
  const openMins     = settings
    ? parseInt(settings.check_in_open.split(":")[0]) * 60 + parseInt(settings.check_in_open.split(":")[1]) : 0;
  const closeMins    = settings
    ? parseInt(settings.check_out_time.split(":")[0]) * 60 + parseInt(settings.check_out_time.split(":")[1]) : 9999;
  const dayClosed    = nowMins >= closeMins;
  const canCheckIn   = !rec?.checkIn && nowMins >= openMins && !dayClosed;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "var(--text3)" }}>
        Loading your dashboard...
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Tab Navigation ── */}
      <div style={{ display: "flex", gap: 0, background: "var(--surface2)", borderRadius: 10, padding: 4 }}>
        {([
          { id: "dashboard", label: "🏠 Dashboard", icon: "🏠" },
          { id: "leaves",    label: "📋 My Leaves",  icon: "📋" },
          { id: "payroll",   label: "💰 My Payroll", icon: "💰" },
          { id: "assets",    label: "📦 My Assets",  icon: "📦" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex: 1, padding: "8px 4px", border: "none", borderRadius: 7, cursor: "pointer",
            fontWeight: 600, fontSize: 13,
            background: activeTab === t.id ? "var(--surface)" : "transparent",
            color: activeTab === t.id ? "var(--primary)" : "var(--text3)",
            boxShadow: activeTab === t.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ PAYROLL TAB ══════════ */}
      {activeTab === "payroll" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {payrollLoading ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text3)" }}>Loading your payroll...</div>
          ) : !myPayroll ? (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>No payroll record found</div>
              <div style={{ fontSize: 13, color: "var(--text3)" }}>Your account may not be linked to an employee record. Contact HR.</div>
            </div>
          ) : (
            <>
              {/* Employee Info Card */}
              <div className="card" style={{ background: "linear-gradient(135deg,#0055A5,#00A9CE)", color: "#fff", border: "none", padding: "18px 22px" }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{myPayroll.employee?.name}</div>
                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                  {myPayroll.employee?.position} · {myPayroll.employee?.department}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{myPayroll.employee?.employeeId}</div>
              </div>

              {/* Month Selector */}
              {myPayroll.payroll?.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text3)" }}>View Month:</span>
                  <select className="form-input" value={selectedPayrollMonth}
                    onChange={e => setSelectedPayrollMonth(e.target.value)}
                    style={{ flex: 1, padding: "6px 12px", fontSize: 14 }}>
                    {myPayroll.payroll.map((p: any) => (
                      <option key={p.month} value={p.month}>
                        {new Date(p.month + "-01").toLocaleDateString("en-EG", { month: "long", year: "numeric" })}
                        {p.status === "Paid" ? " ✅" : " ⏳"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selected Month Payslip */}
              {(() => {
                const p = myPayroll.payroll?.find((x: any) => x.month === selectedPayrollMonth);
                if (!p) return (
                  <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text3)" }}>
                    No payroll data yet. Contact HR.
                  </div>
                );
                const monthLabel = new Date(p.month + "-01").toLocaleDateString("en-EG", { month: "long", year: "numeric" });
                const isPaid = p.status === "Paid";
                return (
                  <>
                    {/* Status Banner */}
                    <div style={{
                      padding: "14px 18px", borderRadius: 10,
                      background: isPaid ? "rgba(46,125,50,0.08)" : "rgba(245,124,0,0.08)",
                      border: `1px solid ${isPaid ? "rgba(46,125,50,0.25)" : "rgba(245,124,0,0.25)"}`,
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <span style={{ fontSize: 28 }}>{isPaid ? "✅" : "⏳"}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: isPaid ? "#2E7D32" : "#F57C00", fontSize: 15 }}>
                          {isPaid ? "Salary Paid" : "Pending Payment"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                          {monthLabel} · {isPaid ? "Your salary has been processed" : "Salary processing in progress"}
                        </div>
                      </div>
                    </div>

                    {/* Net Salary Big */}
                    <div className="card" style={{ padding: "20px 22px", textAlign: "center" }}>
                      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Net Salary — {monthLabel}</div>
                      <div style={{ fontSize: 36, fontWeight: 800, color: "var(--primary)", fontFamily: "monospace" }}>
                        EGP {p.netSalary.toLocaleString()}
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="card" style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Salary Breakdown</div>

                      {/* Earnings */}
                      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, fontWeight: 600 }}>EARNINGS</div>
                      {[
                        { label: "Base Salary",  val: p.baseSalary, plus: true },
                        { label: "Overtime",     val: p.overtime,   plus: true, hide: p.overtime === 0 },
                        { label: "Bonus",        val: p.bonus,      plus: true, hide: p.bonus === 0 },
                      ].filter(r => !r.hide).map(row => (
                        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 14, color: "var(--text2)" }}>{row.label}</span>
                          <span style={{ fontWeight: 500, color: "#2E7D32" }}>+ EGP {row.val.toLocaleString()}</span>
                        </div>
                      ))}

                      {/* Deductions */}
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 12, marginBottom: 6, fontWeight: 600 }}>DEDUCTIONS</div>
                      {[
                        { label: "Penalties",         val: p.penalties,         hide: p.penalties === 0 },
                        { label: "Income Tax (10%)",  val: p.taxDeduction },
                        { label: "Insurance (11%)",   val: p.insuranceDeduction },
                      ].filter(r => !r.hide).map(row => (
                        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 14, color: "var(--text2)" }}>{row.label}</span>
                          <span style={{ fontWeight: 500, color: "#C62828" }}>- EGP {row.val.toLocaleString()}</span>
                        </div>
                      ))}

                      {/* Net */}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", marginTop: 4, borderTop: "2px solid var(--primary)" }}>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>Net Salary</span>
                        <span style={{ fontWeight: 800, fontSize: 18, color: "var(--primary)" }}>EGP {p.netSalary.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* History */}
                    {myPayroll.payroll?.length > 1 && (
                      <div className="card" style={{ padding: "16px 20px" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Payment History</div>
                        {myPayroll.payroll.map((rec: any) => {
                          const label = new Date(rec.month + "-01").toLocaleDateString("en-EG", { month: "short", year: "numeric" });
                          return (
                            <div key={rec.month}
                              onClick={() => setSelectedPayrollMonth(rec.month)}
                              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                                background: rec.month === selectedPayrollMonth ? "rgba(0,85,165,0.06)" : "transparent",
                                border: rec.month === selectedPayrollMonth ? "1px solid rgba(0,85,165,0.2)" : "1px solid transparent",
                                marginBottom: 4, transition: "all 0.15s" }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                                <div style={{ fontSize: 11, color: "var(--text3)" }}>EGP {rec.netSalary.toLocaleString()}</div>
                              </div>
                              <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, fontWeight: 600,
                                background: rec.status === "Paid" ? "rgba(46,125,50,0.1)" : "rgba(245,124,0,0.1)",
                                color: rec.status === "Paid" ? "#2E7D32" : "#F57C00" }}>
                                {rec.status === "Paid" ? "✅ Paid" : "⏳ Pending"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ══════════ LEAVES TAB ══════════ */}
      {activeTab === "leaves" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <div style={{ padding: "16px 20px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>My Leave Requests</div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowLeaveForm(!showLeaveForm)}>
                  {showLeaveForm ? "✕ Cancel" : "+ Request Leave"}
                </button>
              </div>

              {showLeaveForm && (
                <div style={{ padding: "14px", background: "var(--surface2)", borderRadius: 10, marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Leave Type *</label>
                    <select className="form-input" value={leaveType} onChange={e => setLeaveType(e.target.value)}>
                      <option>Annual Leave</option>
                      <option>Sick Leave</option>
                      <option>Emergency Leave</option>
                      <option>Maternity/Paternity Leave</option>
                      <option>Unpaid Leave</option>
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">From *</label>
                      <input className="form-input" type="date" value={leaveFrom} onChange={e => setLeaveFrom(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">To *</label>
                      <input className="form-input" type="date" value={leaveTo} onChange={e => setLeaveTo(e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Reason (optional)</label>
                    <textarea className="form-input" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="Describe your reason..." rows={2} style={{ resize: "none" }} />
                  </div>
                  <button className="btn btn-primary" onClick={handleSubmitLeave} disabled={leaveSubmitting} style={{ width: "100%" }}>
                    {leaveSubmitting ? "Submitting..." : "📨 Submit Leave Request"}
                  </button>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 16 }}>
                {myLeaves.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)", fontSize: 13 }}>
                    No leave requests yet. Click "+ Request Leave" to submit one.
                  </div>
                ) : myLeaves.map((l: any) => (
                  <div key={l.id} style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{l.type}</div>
                        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                          📅 {l.from_date} → {l.to_date} &nbsp;·&nbsp; <strong>{l.days} day{l.days > 1 ? "s" : ""}</strong>
                        </div>
                        {l.note && (
                          <div style={{ marginTop: 6, padding: "5px 10px", borderRadius: 6, background: "rgba(0,0,0,0.04)", fontSize: 12, color: "var(--text2)" }}>
                            Your note: {l.note}
                          </div>
                        )}
                        {l.hr_note && (
                          <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "rgba(0,85,165,0.06)", border: "1px solid rgba(0,85,165,0.2)", fontSize: 12, color: "#0055A5" }}>
                            💬 HR Note: <strong>{l.hr_note}</strong>
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 12, padding: "3px 10px", borderRadius: 6, fontWeight: 600, flexShrink: 0,
                        background: l.status === "Approved" ? "rgba(46,125,50,0.1)" : l.status === "Rejected" ? "rgba(198,40,40,0.1)" : "rgba(245,124,0,0.1)",
                        color: l.status === "Approved" ? "#2E7D32" : l.status === "Rejected" ? "#C62828" : "#F57C00",
                      }}>
                        {l.status === "Approved" ? "✅" : l.status === "Rejected" ? "❌" : "⏳"} {l.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ══════════ ASSETS TAB ══════════ */}
      {activeTab === "assets" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>📦 My Asset Custody</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>Assets issued to your account</div>
              </div>
              <div style={{ padding: "4px 12px", borderRadius: 20, background: "rgba(245,124,0,0.1)", color: "#F57C00", fontSize: 12, fontWeight: 600 }}>
                {myAssets.filter(a => a.status === "In Use").length} in custody
              </div>
            </div>

            {assetsLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Loading your assets...</div>
            ) : myAssets.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                <div style={{ fontWeight: 600, color: "var(--text2)" }}>No assets assigned</div>
                <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>Contact your manager to assign assets to your account.</div>
              </div>
            ) : (
              <>
                {/* Summary pills */}
                <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                  {["In Use", "Returned", "Lost", "Damaged"].map(s => {
                    const cnt = myAssets.filter(a => a.status === s).length;
                    if (!cnt) return null;
                    const col = s === "In Use" ? "#F57C00" : s === "Returned" ? "#2E7D32" : "#C62828";
                    return <span key={s} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 600, background: `${col}18`, color: col }}>{s}: {cnt}</span>;
                  })}
                </div>

                {/* Asset cards */}
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  {myAssets.map((a, i) => {
                    const isInUse = a.status === "In Use";
                    const isOverdue = a.return_date && new Date(a.return_date) < new Date() && isInUse;
                    return (
                      <div key={i} style={{
                        padding: "14px 16px", borderRadius: 10,
                        background: isOverdue ? "rgba(198,40,40,0.06)" : "var(--surface2)",
                        border: `1px solid ${isOverdue ? "rgba(198,40,40,0.2)" : "var(--border)"}`,
                        display: "flex", alignItems: "center", gap: 12
                      }}>
                        <div style={{ width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                          background: isInUse ? "rgba(245,124,0,0.1)" : "rgba(46,125,50,0.1)", flexShrink: 0 }}>
                          📦
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text3)", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 3 }}>
                            {a.category && <span>🏷️ {a.category}</span>}
                            <span>📅 Issued: {a.assign_date || a.issued_date || "—"}</span>
                            {a.return_date && <span style={{ color: isOverdue ? "#C62828" : "var(--text3)" }}>
                              {isOverdue ? "⚠️" : "📤"} Return: {a.return_date}
                            </span>}
                            {a.purpose && <span>📌 {a.purpose}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, fontWeight: 700, flexShrink: 0,
                          background: isInUse ? "rgba(245,124,0,0.12)" : "rgba(46,125,50,0.12)",
                          color: isInUse ? "#F57C00" : "#2E7D32" }}>
                          {isInUse ? "In Use" : "Returned"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ padding: "10px 16px", background: "rgba(0,85,165,0.04)", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
                  💡 Contact your department head or admin to return or report any issues with these assets.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════ DASHBOARD TAB ══════════ */}
      {activeTab === "dashboard" && (<>
      {dayClosed && !rec?.checkIn && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(198,40,40,0.08)", border: "1px solid rgba(198,40,40,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🌙</span>
          <div>
            <div style={{ fontWeight: 700, color: "#C62828" }}>Today's Attendance Closed</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
              Checkout time ({settings?.check_out_time}) has passed. Attendance opens again tomorrow at {settings?.check_in_open}.
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="card" style={{ background: "linear-gradient(135deg, #0055A5 0%, #00A9CE 100%)", color: "#fff", border: "none" }}>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, opacity: 0.85 }}>{fmtDate(now)}</div>
          <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "monospace", letterSpacing: 2, marginTop: 4 }}>
            {fmt(now)}
          </div>
          <div style={{ marginTop: 8, opacity: 0.9 }}>👋 Hello, <strong>{todayData?.name || user?.name}</strong></div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            {todayData?.department} · {todayData?.employeeId}
          </div>
        </div>
        {settings && (
          <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.2)" }}>
            {[
              { label: "Opens", value: settings.check_in_open, icon: "🔓" },
              { label: "Late After", value: settings.late_after, icon: "⏰" },
              { label: "Closes", value: settings.check_out_time, icon: "🔒" },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, padding: "10px 0", textAlign: "center", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.2)" : "none" }}>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{item.icon} {item.label}</div>
                <div style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 15 }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Today Status ── */}
      <div className="card">
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
            Today's Attendance
          </div>
          {rec ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: statusColor[rec.status] || "#999", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                {rec.status === "Present" ? "✅" : rec.status === "Late" ? "⚠️" : "❌"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: statusColor[rec.status] }}>{rec.status}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 13, color: "var(--text2)", flexWrap: "wrap" }}>
                  <span>
                    🟢 Check-in: <strong style={{ fontFamily: "monospace" }}>{rec.checkIn || "—"}</strong>
                    {rec.checkInMethod === "qr" && <span style={{ fontSize: 10, marginLeft: 4, padding: "1px 6px", borderRadius: 4, background: "rgba(0,85,165,0.1)", color: "#0055A5" }}>📱 QR</span>}
                  </span>
                  <span>🔴 Check-out: <strong style={{ fontFamily: "monospace" }}>{rec.checkOut || "—"}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text3)" }}>
              <span style={{ fontSize: 32 }}>⏳</span>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {dayClosed ? "Attendance closed for today" : "Not checked in yet"}
                </div>
                <div style={{ fontSize: 12 }}>
                  {!dayClosed && nowMins < openMins
                    ? `Check-in opens at ${settings?.check_in_open}`
                    : dayClosed
                    ? `See you tomorrow at ${settings?.check_in_open}`
                    : "Use QR or camera to check in"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>

        {/* Show My QR */}
        <button className="btn btn-primary"
          onClick={canCheckIn ? loadQr : undefined}
          disabled={!canCheckIn || actionLoading || qrLoading}
          style={{ padding: "14px 8px", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: canCheckIn ? 1 : 0.45, cursor: canCheckIn ? "pointer" : "not-allowed", background: canCheckIn ? "linear-gradient(135deg,#0055A5,#00A9CE)" : undefined }}>
          <span style={{ fontSize: 26 }}>📱</span>
          <span style={{ fontWeight: 700, fontSize: 12 }}>{rec?.checkIn ? "Checked In ✅" : qrLoading ? "Loading..." : "Show My QR"}</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>{rec?.checkIn ? `at ${rec.checkIn}` : "View QR code"}</span>
        </button>

        {/* Camera Scan */}
        <button className="btn"
          onClick={canCheckIn ? () => setShowScan(true) : undefined}
          disabled={!canCheckIn || actionLoading}
          style={{ padding: "14px 8px", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: canCheckIn ? "linear-gradient(135deg,#00897B,#26A69A)" : "rgba(0,0,0,0.05)", color: canCheckIn ? "#fff" : "var(--text3)", border: "none", opacity: canCheckIn ? 1 : 0.45, cursor: canCheckIn ? "pointer" : "not-allowed" }}>
          <span style={{ fontSize: 26 }}>📷</span>
          <span style={{ fontWeight: 700, fontSize: 12 }}>Scan QR</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>Camera scan</span>
        </button>

        {/* Check-Out */}
        <button className="btn"
          onClick={rec?.checkIn && !isDone ? handleCheckOut : undefined}
          disabled={!rec?.checkIn || isDone || actionLoading}
          style={{ padding: "14px 8px", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: isDone ? "rgba(46,125,50,0.1)" : rec?.checkIn ? "linear-gradient(135deg,#C62828,#E53935)" : "rgba(0,0,0,0.05)", color: isDone ? "#2E7D32" : rec?.checkIn ? "#fff" : "var(--text3)", border: "none", opacity: rec?.checkIn ? 1 : 0.45, cursor: rec?.checkIn && !isDone ? "pointer" : "not-allowed" }}>
          <span style={{ fontSize: 26 }}>{isDone ? "🏠" : "🚪"}</span>
          <span style={{ fontWeight: 700, fontSize: 12 }}>{isDone ? "Checked Out" : "Check-Out"}</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>{isDone ? `at ${rec?.checkOut}` : rec?.checkIn ? "Tap to exit" : "Check in first"}</span>
        </button>
      </div>

      {/* GPS Status */}
      <div style={{ padding: "10px 14px", borderRadius: 8, background: gpsStatus === "ok" ? "rgba(46,125,50,0.08)" : "rgba(0,0,0,0.04)", border: `1px solid ${gpsStatus === "ok" ? "rgba(46,125,50,0.2)" : "rgba(0,0,0,0.08)"}`, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
        <span style={{ fontSize: 18 }}>{gpsStatus === "ok" ? "📍" : "🌐"}</span>
        <div style={{ flex: 1 }}>
          {gpsStatus === "ok" && gps
            ? `GPS Active: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`
            : gpsStatus === "error" ? "GPS unavailable — check-in proceeds without location"
            : gpsStatus === "loading" ? "Acquiring GPS..." : "GPS acquired automatically on check-in"}
        </div>
        {gpsStatus === "idle" && <button className="btn btn-secondary btn-sm" onClick={acquireGps}>Enable GPS</button>}
      </div>

      {/* ── QR Modal (REAL QR CODE) ── */}
      {showQr && qrData && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Your Daily QR Code</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
                Scannable with any QR app · Valid until midnight
              </div>
            </div>

            {/* REAL QR CODE */}
            <div style={{ display: "flex", justifyContent: "center", padding: 16, background: "#fff", borderRadius: 12 }}>
              <QRCodeSVG
                value={qrData.qrData}
                size={220}
                level="M"
                includeMargin={false}
              />
            </div>

            <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--surface2)", borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>{qrData.name}</div>
              <div style={{ color: "var(--text2)", fontSize: 12 }}>{qrData.employeeId} · {qrData.department}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary" onClick={() => doQrCheckIn(qrData.qrData)} disabled={actionLoading} style={{ width: "100%", padding: 13, fontSize: 15 }}>
                {actionLoading ? "Verifying..." : "✅ Confirm Check-In"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowQr(false)} style={{ width: "100%" }}>
                Cancel
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
              🔒 HMAC-SHA256 daily token · Changes at midnight
            </div>
          </div>
        </div>
      )}

      {/* Camera Scanner */}
      {showScan && <CameraScanner onScan={(d) => { setShowScan(false); doQrCheckIn(d); }} onClose={() => setShowScan(false)} />}
      </>)}
    </div>
  );
}
