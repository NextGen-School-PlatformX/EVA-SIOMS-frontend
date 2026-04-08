"use client";

import { useState, useEffect, useRef, useCallback } from "react";
// @ts-ignore
import { QRCodeSVG } from "qrcode.react";
import { KPICard, SearchBar, Pagination, Badge } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { apiClient } from "@/services/apiClient";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import type { AttendanceRecord } from "@/types";

// QR rendering uses qrcode.react (real scannable QR codes)

// ─── Camera Scanner (for Admin QR Station) ────────────────────────────────────

function CameraScanner({ onScan, onClose }: { onScan: (data: string) => void; onClose: () => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef   = useRef<number>(0);
  const [jsQR, setJsQR]     = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "scanning" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    import("jsqr").then((m) => setJsQR(() => m.default)).catch(() => {
      setErrorMsg("jsQR library not available. Run: npm install jsqr in the frontend folder.");
      setStatus("error");
    });
  }, []);

  const startCamera = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setStatus("scanning"); }
    } catch (e: any) {
      setErrorMsg(e.name === "NotAllowedError"
        ? "Camera permission denied. Please allow camera access in your browser."
        : "Cannot access camera. Make sure no other app is using it.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (jsQR) startCamera();
    return () => { cancelAnimationFrame(animRef.current); streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [jsQR, startCamera]);

  useEffect(() => {
    if (status !== "scanning" || !jsQR) return;
    const scan = () => {
      const video = videoRef.current, canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d")!;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: "dontInvert" });
        if (code?.data) { cancelAnimationFrame(animRef.current); streamRef.current?.getTracks().forEach(t => t.stop()); onScan(code.data); return; }
      }
      animRef.current = requestAnimationFrame(scan);
    };
    animRef.current = requestAnimationFrame(scan);
    return () => cancelAnimationFrame(animRef.current);
  }, [status, jsQR, onScan]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>📷 Camera QR Scan</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        {status === "loading" && <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}><div style={{ fontSize: 40, marginBottom: 12 }}>📷</div><div>Loading camera...</div></div>}
        {status === "error" && <div style={{ textAlign: "center", padding: 20 }}><div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div><div style={{ color: "#C62828", fontWeight: 600, marginBottom: 12 }}>{errorMsg}</div><button className="btn btn-primary" onClick={startCamera}>Retry</button></div>}
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", display: status === "scanning" ? "block" : "none" }}>
          <video ref={videoRef} style={{ width: "100%", display: "block", borderRadius: 10 }} playsInline muted />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ width: "65%", aspectRatio: "1", border: "3px solid #0055A5", borderRadius: 12, boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)" }} />
          </div>
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {status === "scanning" && <div style={{ marginTop: 12, fontSize: 13, color: "var(--text2)", textAlign: "center" }}>📱 Point camera at employee's QR code</div>}
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const ADMIN_TABS = [
  { id: "list",     label: "📋 Register" },
  { id: "qr",      label: "📱 QR Station" },
  { id: "checkin", label: "✍️ Manual" },
  { id: "settings",label: "⚙️ Settings" },
];

// ─── Process Day Button ───────────────────────────────────────────────────────

function ProcessDayButton({ settings, onDone }: { settings: any; onDone: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  // Check if current time is past checkout time
  const isPastCheckout = (() => {
    if (!settings?.check_out_time) return false;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const [h, m] = settings.check_out_time.split(":").map(Number);
    return nowMins >= h * 60 + m;
  })();

  const handleAutoCheckout = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<any>("/attendance/auto-checkout", {});
      toast(`✅ Auto checkout done: ${res.autoCheckedOut} employees checked out at ${res.checkOutTime}`, "success");
      onDone();
    } catch (e: any) {
      toast(e.message || "Auto checkout failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessDay = async () => {
    setLoading(true);
    setConfirm(false);
    try {
      const res = await apiClient.post<any>("/attendance/process-day", {});

      // Auto export CSV
      const today = new Date().toISOString().split("T")[0];
      const csv = [
        ["ID", "Name", "Department", "Check In", "Check Out", "Status", "Method"],
        ...res.records.map((a: any) => [
          a.employeeId, a.employeeName, a.department,
          a.checkIn || "N/A", a.checkOut || "N/A",
          a.status, a.checkInMethod || "manual"
        ]),
      ].map((r) => r.map((c: any) => `"${c}"`).join(",")).join("\n");

      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-processed-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast(
        `✅ يوم تم! Auto-checkout: ${res.autoCheckedOut} | Absent: ${res.markedAbsent} | تم export CSV`,
        "success"
      );
      onDone();
    } catch (e: any) {
      toast(e.message || "Process failed", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!isPastCheckout) return null; // Hidden before checkout time

  return (
    <>
      <button
        className="btn btn-sm"
        style={{ background: "#7B1FA2", color: "white", fontWeight: 700 }}
        onClick={() => setConfirm(true)}
        disabled={loading}
      >
        {loading ? "⏳ Processing..." : "🏁 Process Day"}
      </button>

      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, maxWidth: 420, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>🏁 Process End of Day</div>
            <div style={{ color: "var(--text2)", marginBottom: 20, lineHeight: 1.6 }}>
              هيتعمل الآتي تلقائياً:
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>✅ Auto checkout لكل من عمل check-in ولم يعمل checkout</li>
                <li>❌ تسجيل Absent لكل من لم يحضر</li>
                <li>📊 Export CSV تلقائي لليوم كاملاً</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(false)}>إلغاء</button>
              <button
                className="btn btn-sm"
                style={{ background: "#7B1FA2", color: "white", fontWeight: 700 }}
                onClick={handleProcessDay}
              >
                تأكيد ومتابعة
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



export default function Attendance() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "HR";

  const [tab, setTab]               = useState("list");
  const [search, setSearch]         = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [data, setData]             = useState<AttendanceRecord[]>([]);
  const [settings, setSettings]     = useState<any>(null);
  const perPage = 15;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, cfg] = await Promise.all([
        apiClient.get<any>(`/attendance?date=${dateFilter}&limit=200`),
        apiClient.get<any>("/attendance/settings"),
      ]);
      setData(res.data || res);
      setSettings(cfg);
    } catch { toast("Failed to fetch attendance data", "error"); }
    finally { setLoading(false); }
  }, [dateFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Auto Checkout: fires when checkout time arrives ──────────────────────
  useEffect(() => {
    if (!isAdmin || !settings?.check_out_time) return;

    const checkAndAutoCheckout = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const [h, m] = settings.check_out_time.split(":").map(Number);
      const checkoutMins = h * 60 + m;

      // Fire exactly at checkout time (within 1 minute window)
      if (nowMins === checkoutMins) {
        apiClient.post<any>("/attendance/auto-checkout", {})
          .then((res) => {
            if (res.autoCheckedOut > 0) {
              toast(`🔔 Auto checkout: ${res.autoCheckedOut} employees checked out automatically at ${res.checkOutTime}`, "success");
              fetchData();
            }
          })
          .catch(() => {});
      }
    };

    // Check every minute
    const interval = setInterval(checkAndAutoCheckout, 60000);
    return () => clearInterval(interval);
  }, [isAdmin, settings]);

  const filtered = data.filter((a) =>
    a.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    a.employeeId.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    present: filtered.filter((a) => a.status === "Present").length,
    absent:  filtered.filter((a) => a.status === "Absent").length,
    late:    filtered.filter((a) => a.status === "Late").length,
  };

  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const handleExport = () => {
    const csv = [
      ["ID","Name","Department","Check In","Check Out","Status","Method"],
      ...filtered.map((a) => [a.employeeId, a.employeeName, a.department, a.checkIn || "N/A", a.checkOut || "N/A", a.status, (a as any).checkInMethod || "manual"]),
    ].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `attendance-${dateFilter}.csv`; a.click();
    toast("Exported!", "success");
  };

  const handleCheckOut = async (record: any) => {
    if (record.checkOut) { toast("Already checked out", "error"); return; }
    try { await apiClient.post(`/attendance/check-out/${record.id}`, {}); toast(`${record.employeeName} checked out ✅`, "success"); fetchData(); }
    catch (e: any) { toast(e.message || "Failed", "error"); }
  };

  return (
    <div className="fade-in">
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <KPICard icon="attendance" label="Present" value={stats.present} color="#2E7D32" bg="rgba(46,125,50,0.1)" />
        <KPICard icon="close"      label="Absent"  value={stats.absent}  color="#C62828" bg="rgba(198,40,40,0.1)" />
        <KPICard icon="alert"      label="Late"    value={stats.late}    color="#F57C00" bg="rgba(245,124,0,0.1)" />
        <KPICard icon="users"      label="Total"   value={filtered.length} color="#0055A5" bg="rgba(0,85,165,0.1)" />
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {ADMIN_TABS.filter(t => t.id !== "settings" || isAdmin).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-secondary"}`}>{t.label}</button>
        ))}
      </div>

      {/* ══ REGISTER TAB ══ */}
      {tab === "list" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Daily Attendance Register</span>
            <div style={{ display: "flex", gap: 8 }}>
              {isAdmin && settings && <ProcessDayButton settings={settings} onDone={fetchData} />}
              {isAdmin && settings && <MarkLateButton settings={settings} onDone={fetchData} />}
              <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}><Icon name="trend" size={14} /> Refresh</button>
              <button className="btn btn-primary btn-sm" onClick={handleExport}><Icon name="download" size={14} /> Export</button>
            </div>
          </div>
          <div className="filter-bar">
            <SearchBar value={search} onChange={setSearch} placeholder="Search employee..." />
            <input type="date" className="form-input" value={dateFilter} style={{ width: "auto" }} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} />
          </div>
          {settings && (
            <div style={{ display: "flex", gap: 24, padding: "8px 16px", background: "rgba(0,85,165,0.04)", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text2)" }}>
              <span>🔓 Opens: <strong>{settings.check_in_open}</strong></span>
              <span>⏰ Late after: <strong>{settings.late_after}</strong></span>
              <span>🏠 Checkout: <strong>{settings.check_out_time}</strong></span>
            </div>
          )}
          {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Loading...</div> : (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Department</th><th>Check In</th><th>Check Out</th><th>Method</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {paged.length > 0 ? paged.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{row.employeeName?.[0]}</div>
                            <div><div style={{ fontWeight: 500 }}>{row.employeeName}</div><div style={{ fontSize: 11, color: "var(--text3)" }}>{row.employeeId}</div></div>
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>{row.department}</td>
                        <td><span style={{ fontFamily: "monospace", color: row.checkIn ? "var(--text)" : "var(--text3)" }}>{row.checkIn || "—"}</span></td>
                        <td><span style={{ fontFamily: "monospace", color: row.checkOut ? "var(--text)" : "var(--text3)" }}>{row.checkOut || "—"}</span></td>
                        <td>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: (row as any).checkInMethod === "qr" ? "rgba(0,85,165,0.1)" : (row as any).checkInMethod === "camera" ? "rgba(0,169,206,0.1)" : "rgba(0,0,0,0.06)", color: (row as any).checkInMethod === "qr" ? "#0055A5" : (row as any).checkInMethod === "camera" ? "#00A9CE" : "var(--text2)" }}>
                            {(row as any).checkInMethod === "qr" ? "📱 QR" : (row as any).checkInMethod === "camera" ? "📷 Scan" : "✍️ Manual"}
                          </span>
                        </td>
                        <td><Badge status={row.status} /></td>
                        <td>
                          {row.checkIn && !row.checkOut ? <button className="btn btn-xs btn-danger" onClick={() => handleCheckOut(row)} style={{ fontSize: 11 }}>🚪 Checkout</button>
                            : row.checkOut ? <span style={{ fontSize: 11, color: "var(--text3)" }}>Done ✅</span> : null}
                        </td>
                      </tr>
                    )) : <tr><td colSpan={7} style={{ textAlign: "center", padding: 20 }}>No records found</td></tr>}
                  </tbody>
                </table>
              </div>
              <Pagination total={filtered.length} perPage={perPage} page={page} setPage={setPage} />
            </>
          )}
        </div>
      )}

      {tab === "qr" && <QrStationTab onSuccess={fetchData} />}
      {tab === "checkin" && <ManualCheckInPanel onSuccess={fetchData} />}
      {tab === "settings" && isAdmin && <AttendanceSettings settings={settings} onSaved={(s) => setSettings(s)} />}
    </div>
  );
}

// ─── QR Station Tab ───────────────────────────────────────────────────────────

function QrStationTab({ onSuccess }: { onSuccess: () => void }) {
  const toast = useToast();
  const [empId, setEmpId]       = useState("");
  const [qrInfo, setQrInfo]     = useState<any>(null);
  const [qrLoading, setQrLoad]  = useState(false);
  const [scannedText, setScanned] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [gps, setGps]           = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "ok" | "error">("idle");
  // Camera scan
  const [showCamera, setShowCamera] = useState(false);

  const acquireGps = () => {
    if (!navigator.geolocation) { setGpsStatus("error"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setGps({ lat: p.coords.latitude, lng: p.coords.longitude }); setGpsStatus("ok"); },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const loadQr = async () => {
    if (!empId.trim()) { toast("Enter employee ID", "error"); return; }
    setQrLoad(true);
    try { const d = await apiClient.get<any>(`/attendance/qr/${empId.trim()}`); setQrInfo(d); }
    catch (e: any) { toast(e.message || "Not found", "error"); }
    finally { setQrLoad(false); }
  };

  const handleVerify = async (rawData?: string) => {
    const payload = rawData || scannedText;
    if (!payload.trim()) { toast("Paste or scan QR data", "error"); return; }
    setVerifying(true); setLastResult(null);
    try {
      const body: any = { qrData: payload };
      if (gps) { body.lat = gps.lat; body.lng = gps.lng; }
      const r = await apiClient.post<any>("/attendance/qr-checkin", body);
      setLastResult({ ok: true, record: r.record });
      toast(`✅ ${r.record.employeeName} checked in at ${r.record.checkIn}!`, "success");
      setScanned(""); onSuccess();
    } catch (e: any) {
      setLastResult({ ok: false, message: e.message });
      toast(e.message || "Check-in failed", "error");
    } finally { setVerifying(false); }
  };

  const handleCameraScan = (data: string) => {
    setShowCamera(false);
    setScanned(data);
    handleVerify(data);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* ─── LEFT: Display QR for employee ─── */}
      <div className="card">
        <div className="card-header"><span className="card-title">🪪 Employee QR Display</span></div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, color: "var(--text2)" }}>Enter employee ID to show their daily QR code.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" value={empId} onChange={(e) => setEmpId(e.target.value)} placeholder="e.g. EMP-1001" onKeyDown={(e) => e.key === "Enter" && loadQr()} />
            <button className="btn btn-primary" onClick={loadQr} disabled={qrLoading}>{qrLoading ? "..." : "Show QR"}</button>
          </div>
          {qrInfo ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              {/* REAL QR CODE - scannable by any QR app */}
              <div style={{ background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #eee" }}>
                <QRCodeSVG value={qrInfo.qrData} size={210} level="M" includeMargin={false} />
              </div>
              <div style={{ padding: "12px 20px", background: "var(--surface2)", borderRadius: 8, textAlign: "center", width: "100%" }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{qrInfo.name}</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>{qrInfo.employeeId} · {qrInfo.department}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>🔒 Valid: {today} · Expires midnight</div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, color: "var(--text3)", gap: 8 }}>
              <span style={{ fontSize: 56 }}>📱</span>
              <div style={{ fontWeight: 600 }}>Enter Employee ID</div>
              <div style={{ fontSize: 12, textAlign: "center" }}>Their daily rotating QR will appear here</div>
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT: Scan/Verify panel ─── */}
      <div className="card">
        <div className="card-header"><span className="card-title">✅ Scan & Verify</span></div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* GPS */}
          <div style={{ padding: 10, borderRadius: 8, display: "flex", alignItems: "center", gap: 10, background: gpsStatus === "ok" ? "rgba(46,125,50,0.07)" : "rgba(0,0,0,0.04)", border: `1px solid ${gpsStatus === "ok" ? "rgba(46,125,50,0.2)" : "var(--border)"}`, fontSize: 13 }}>
            <span>{gpsStatus === "ok" ? "📍" : "🌐"}</span>
            <div style={{ flex: 1 }}>{gpsStatus === "ok" && gps ? `Location: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : "Enable GPS to verify location at check-in"}</div>
            <button className="btn btn-secondary btn-sm" onClick={acquireGps}>{gpsStatus === "ok" ? "✅ GPS On" : "Enable GPS"}</button>
          </div>

          {/* Camera Scan Button */}
          <button className="btn btn-primary" onClick={() => setShowCamera(true)} style={{ width: "100%", padding: 12, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>📷</span> Camera Scan
          </button>

          {/* Paste QR input */}
          <div className="form-group">
            <label className="form-label">Or Paste QR Code Data</label>
            <textarea className="form-input" rows={4} value={scannedText} onChange={(e) => setScanned(e.target.value)}
              style={{ fontFamily: "monospace", fontSize: 11 }}
              placeholder={`{"type":"sioms-attendance","employeeId":"EMP-1001",...}`} />
          </div>

          <button className="btn btn-secondary" onClick={() => handleVerify()} disabled={verifying || !scannedText.trim()} style={{ width: "100%", padding: 12 }}>
            {verifying ? "Verifying..." : "✅ Confirm Check-In (Manual Paste)"}
          </button>

          {lastResult && (
            <div style={{ padding: 14, borderRadius: 8, background: lastResult.ok ? "rgba(46,125,50,0.08)" : "rgba(198,40,40,0.08)", border: `1px solid ${lastResult.ok ? "rgba(46,125,50,0.25)" : "rgba(198,40,40,0.25)"}` }}>
              {lastResult.ok ? (
                <>
                  <div style={{ fontWeight: 700, color: "#2E7D32", fontSize: 15 }}>✅ Check-In Recorded</div>
                  <div style={{ marginTop: 6, fontSize: 14 }}>{lastResult.record.employeeName}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>{lastResult.record.department} · {lastResult.record.checkIn} · <strong style={{ color: lastResult.record.status === "Late" ? "#F57C00" : "#2E7D32" }}>{lastResult.record.status}</strong></div>
                </>
              ) : <div style={{ color: "#C62828", fontWeight: 600 }}>❌ {lastResult.message}</div>}
            </div>
          )}

          <div style={{ padding: 12, background: "rgba(0,85,165,0.06)", borderRadius: 8, fontSize: 12, color: "var(--text2)" }}>
            🔒 <strong>QR Security:</strong> Each employee has a unique daily HMAC-SHA256 token that changes at midnight.
          </div>
        </div>
      </div>

      {/* Camera Scanner Modal */}
      {showCamera && <CameraScanner onScan={handleCameraScan} onClose={() => setShowCamera(false)} />}
    </div>
  );
}

// ─── Mark Late Button ─────────────────────────────────────────────────────────

function MarkLateButton({ settings, onDone }: { settings: any; onDone: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const doMark = async () => {
    setLoading(true);
    try { const res = await apiClient.post<any>("/attendance/mark-late-now", {}); toast(`Marked ${res.markedLate} employees as Late ⚠️`, "success"); setConfirm(false); onDone(); }
    catch (e: any) { toast(e.message || "Failed", "error"); }
    finally { setLoading(false); }
  };

  if (confirm) return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#F57C00" }}>After {settings.late_after}?</span>
      <button className="btn btn-danger btn-sm" onClick={doMark} disabled={loading}>{loading ? "..." : "Confirm"}</button>
      <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
    </div>
  );

  return (
    <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)} style={{ borderColor: "#F57C00", color: "#F57C00" }}>⚠️ Mark Late Now</button>
  );
}

// ─── Attendance Settings (Timing + Weekly Schedule + Holidays) ────────────────

function AttendanceSettings({ settings, onSaved }: { settings: any; onSaved: (s: any) => void }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"timing" | "schedule" | "holidays" | "calendar">("timing");

  // Timing form
  const [form, setForm] = useState({
    check_in_open:  settings?.check_in_open  || "07:00",
    late_after:     settings?.late_after     || "08:15",
    check_out_time: settings?.check_out_time || "16:00",
  });
  const [saving, setSaving] = useState(false);

  // Weekly schedule
  const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;
  const DAY_LABELS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const [schedule, setSchedule] = useState<Record<string, boolean>>({ sunday:false, monday:true, tuesday:true, wednesday:true, thursday:true, friday:false, saturday:false });
  const [schedLoading, setSchedLoad] = useState(true);
  const [schedSaving, setSchedSave] = useState(false);

  // Holidays
  const [holidays, setHolidays] = useState<any[]>([]);
  const [holLoading, setHolLoad] = useState(true);
  const [newHolDate, setNewHolDate] = useState("");
  const [newHolName, setNewHolName] = useState("");
  const [addingHol, setAddingHol] = useState(false);

  // Calendar
  const [calFrom, setCalFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split("T")[0];
  });
  const [calTo, setCalTo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay()));
    return d.toISOString().split("T")[0];
  });
  const [calendar, setCalendar] = useState<any[]>([]);
  const [calLoad, setCalLoad]   = useState(false);

  useEffect(() => {
    apiClient.get<any>("/attendance/schedule").then(s => {
      setSchedule({ sunday: !!s.sunday, monday: !!s.monday, tuesday: !!s.tuesday, wednesday: !!s.wednesday, thursday: !!s.thursday, friday: !!s.friday, saturday: !!s.saturday });
      setSchedLoad(false);
    }).catch(() => setSchedLoad(false));
    apiClient.get<any[]>("/attendance/holidays").then(h => { setHolidays(h); setHolLoad(false); }).catch(() => setHolLoad(false));
  }, []);

  const fetchCalendar = async () => {
    setCalLoad(true);
    try { const c = await apiClient.get<any[]>(`/attendance/calendar?from=${calFrom}&to=${calTo}`); setCalendar(c); }
    catch { toast("Failed to load calendar", "error"); }
    finally { setCalLoad(false); }
  };

  useEffect(() => { if (activeTab === "calendar") fetchCalendar(); }, [activeTab, calFrom, calTo]);

  const saveTiming = async () => {
    setSaving(true);
    try { const updated = await apiClient.put<any>("/attendance/settings", form); toast("Settings saved ✅", "success"); onSaved(updated); }
    catch (e: any) { toast(e.message || "Failed", "error"); }
    finally { setSaving(false); }
  };

  const saveSchedule = async () => {
    setSchedSave(true);
    try {
      const body: any = {};
      DAY_NAMES.forEach(d => { body[d] = schedule[d] ? 1 : 0; });
      await apiClient.put<any>("/attendance/schedule", body);
      toast("Schedule saved ✅", "success");
    } catch (e: any) { toast(e.message || "Failed", "error"); }
    finally { setSchedSave(false); }
  };

  const addHoliday = async () => {
    if (!newHolDate || !newHolName.trim()) { toast("Date and name required", "error"); return; }
    setAddingHol(true);
    try {
      const h = await apiClient.post<any>("/attendance/holidays", { date: newHolDate, name: newHolName.trim() });
      setHolidays(prev => [...prev, h].sort((a,b) => a.date.localeCompare(b.date)));
      setNewHolDate(""); setNewHolName("");
      toast("Holiday added ✅", "success");
    } catch (e: any) { toast(e.message || "Failed", "error"); }
    finally { setAddingHol(false); }
  };

  const deleteHoliday = async (id: number) => {
    try {
      await apiClient.delete(`/attendance/holidays/${id}`);
      setHolidays(prev => prev.filter(h => h.id !== id));
      toast("Holiday removed", "success");
    } catch (e: any) { toast(e.message || "Failed", "error"); }
  };

  const subTabs = [
    { id: "timing", label: "⏰ Timing" },
    { id: "schedule", label: "📅 Work Days" },
    { id: "holidays", label: "🎉 Holidays" },
    { id: "calendar", label: "🗓️ Calendar" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`btn btn-sm ${activeTab === t.id ? "btn-primary" : "btn-secondary"}`}>{t.label}</button>
        ))}
      </div>

      {/* ── Timing ── */}
      {activeTab === "timing" && (
        <div className="card" style={{ maxWidth: 520 }}>
          <div className="card-header"><span className="card-title">⏰ Attendance Timing</span></div>
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ padding: 12, background: "rgba(0,85,165,0.06)", borderRadius: 8, fontSize: 13, color: "var(--text2)" }}>
              💡 <strong>check_in_open</strong> هو الوقت الفعلي اللي يبدأ فيه اليوم. الحضور قبله مرفوض تلقائياً.
            </div>
            {[
              { key: "check_in_open",  label: "🔓 فتح باب الحضور",   help: "الحضور قبل هذا الوقت مرفوض — هو بداية اليوم الفعلي" },
              { key: "late_after",     label: "⏰ وقت التأخر",         help: "اللي يسجل بعد هذا الوقت يتسجل 'Late' تلقائياً" },
              { key: "check_out_time", label: "🏠 ميعاد الانصراف",     help: "يتعرض للموظفين كـ expected checkout" },
            ].map(({ key, label, help }) => (
              <div key={key} className="form-group">
                <label className="form-label">{label}</label>
                <input type="time" className="form-input" value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={{ width: "auto", fontFamily: "monospace", fontSize: 16 }} />
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{help}</div>
              </div>
            ))}
            <button className="btn btn-primary" onClick={saveTiming} disabled={saving}>{saving ? "جاري الحفظ..." : "💾 حفظ الإعدادات"}</button>
            {settings?.updated_by && <div style={{ fontSize: 11, color: "var(--text3)" }}>آخر تعديل بواسطة {settings.updated_by}</div>}
          </div>
        </div>
      )}

      {/* ── Work Days ── */}
      {activeTab === "schedule" && (
        <div className="card" style={{ maxWidth: 520 }}>
          <div className="card-header"><span className="card-title">📅 جدول أيام العمل</span></div>
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text2)" }}>حدد أيام العمل في الأسبوع. أيام الراحة لا يُقبل فيها تسجيل حضور.</div>
            {schedLoading ? <div>Loading...</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {DAY_NAMES.map((day, i) => (
                  <div key={day} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, background: schedule[day] ? "rgba(46,125,50,0.07)" : "rgba(0,0,0,0.03)", border: `1px solid ${schedule[day] ? "rgba(46,125,50,0.2)" : "var(--border)"}` }}>
                    <input type="checkbox" checked={schedule[day]} onChange={(e) => setSchedule(s => ({ ...s, [day]: e.target.checked }))} style={{ width: 18, height: 18, cursor: "pointer" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{DAY_LABELS[i]}</div>
                      <div style={{ fontSize: 12, color: "var(--text3)" }}>{day.charAt(0).toUpperCase() + day.slice(1)}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: schedule[day] ? "#2E7D32" : "#9E9E9E" }}>{schedule[day] ? "✅ يوم عمل" : "⛔ إجازة"}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary" onClick={saveSchedule} disabled={schedSaving}>{schedSaving ? "جاري الحفظ..." : "💾 حفظ الجدول الأسبوعي"}</button>
          </div>
        </div>
      )}

      {/* ── Holidays ── */}
      {activeTab === "holidays" && (
        <div className="card">
          <div className="card-header"><span className="card-title">🎉 العطلات الرسمية</span></div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text2)" }}>أضف العطلات الرسمية. في هذه الأيام لا يُقبل تسجيل حضور وتظهر في التقويم.</div>
            {/* Add new */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Date</label>
                <input type="date" className="form-input" value={newHolDate} onChange={(e) => setNewHolDate(e.target.value)} style={{ width: "auto" }} />
              </div>
              <div className="form-group" style={{ flex: 1, margin: 0, minWidth: 200 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Holiday Name</label>
                <input className="form-input" value={newHolName} onChange={(e) => setNewHolName(e.target.value)} placeholder="e.g. National Day, Eid Al-Fitr..." onKeyDown={(e) => e.key === "Enter" && addHoliday()} />
              </div>
              <button className="btn btn-primary" onClick={addHoliday} disabled={addingHol}>{addingHol ? "..." : "➕ Add"}</button>
            </div>

            {/* List */}
            {holLoading ? <div>Loading...</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {holidays.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--text3)" }}>No holidays added yet</div>}
                {holidays.map(h => (
                  <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(245,124,0,0.06)", border: "1px solid rgba(245,124,0,0.15)" }}>
                    <span style={{ fontSize: 20 }}>🎉</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{h.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text2)", fontFamily: "monospace" }}>{h.date}</div>
                    </div>
                    <button className="btn btn-xs btn-danger" onClick={() => deleteHoliday(h.id)}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Calendar ── */}
      {activeTab === "calendar" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🗓️ تقويم الحضور</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="date" className="form-input" value={calFrom} onChange={(e) => setCalFrom(e.target.value)} style={{ width: "auto", fontSize: 13 }} />
              <span style={{ color: "var(--text3)" }}>→</span>
              <input type="date" className="form-input" value={calTo} onChange={(e) => setCalTo(e.target.value)} style={{ width: "auto", fontSize: 13 }} />
              <button className="btn btn-primary btn-sm" onClick={fetchCalendar} disabled={calLoad}>🔄 View</button>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {calLoad && <div style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>Loading calendar...</div>}
            {!calLoad && calendar.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>Select a date range and click View</div>}
            {!calLoad && calendar.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {calendar.map(day => {
                  const isHoliday = day.reason === "holiday";
                  const isWeekend = !day.isWorking && !isHoliday;
                  const isToday = day.date === new Date().toISOString().split("T")[0];
                  const bg = isHoliday ? "rgba(245,124,0,0.08)" : isWeekend ? "rgba(0,0,0,0.04)" : "rgba(46,125,50,0.05)";
                  const border = isHoliday ? "rgba(245,124,0,0.3)" : isWeekend ? "rgba(0,0,0,0.1)" : "rgba(46,125,50,0.2)";
                  return (
                    <div key={day.date} style={{ padding: 12, borderRadius: 10, background: bg, border: `2px solid ${isToday ? "#0055A5" : border}`, position: "relative" }}>
                      {isToday && <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, color: "#0055A5", fontWeight: 700 }}>TODAY</div>}
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>{day.dayName}</div>
                      <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "monospace" }}>{day.date.slice(5)}</div>
                      {isHoliday && <div style={{ fontSize: 11, color: "#F57C00", fontWeight: 600, marginTop: 4 }}>🎉 {day.holidayName}</div>}
                      {isWeekend && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>⛔ Day Off</div>}
                      {day.isWorking && day.stats && (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ fontSize: 11, color: "#2E7D32" }}>✅ {day.stats.present || 0} Present</div>
                          {day.stats.late > 0 && <div style={{ fontSize: 11, color: "#F57C00" }}>⚠️ {day.stats.late} Late</div>}
                          {day.stats.absent > 0 && <div style={{ fontSize: 11, color: "#C62828" }}>❌ {day.stats.absent} Absent</div>}
                          {day.stats.total === 0 && <div style={{ fontSize: 11, color: "var(--text3)" }}>No records yet</div>}
                          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>Opens: {day.settings.check_in_open}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manual Check-In ─────────────────────────────────────────────────────────

function ManualCheckInPanel({ onSuccess }: { onSuccess: () => void }) {
  const toast = useToast();
  const [empId, setEmpId]     = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<any>(null);

  const handleCheckIn = async () => {
    if (!empId.trim()) { toast("Enter employee ID", "error"); return; }
    setLoading(true); setResult(null);
    try {
      const rec = await apiClient.post<any>("/attendance/check-in", { employeeId: empId.trim() });
      setResult({ success: true, record: rec });
      toast(`✅ ${rec.employeeName} — ${rec.status} at ${rec.checkIn}`, "success");
      setEmpId(""); onSuccess();
    } catch (e: any) {
      setResult({ success: false, message: e.message });
      toast(e.message || "Failed", "error");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="card">
        <div className="card-header"><span className="card-title">✍️ Manual Check-In</span></div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Employee ID</label>
            <input className="form-input" value={empId} style={{ fontSize: 16 }} onChange={(e) => setEmpId(e.target.value)} placeholder="e.g. EMP-1001" onKeyDown={(e) => e.key === "Enter" && handleCheckIn()} />
          </div>
          <button className="btn btn-primary" onClick={handleCheckIn} disabled={loading} style={{ width: "100%", padding: 12 }}>
            {loading ? "Recording..." : "✅ Record Check-In"}
          </button>
          {result && (
            <div style={{ padding: 16, borderRadius: 8, background: result.success ? "rgba(46,125,50,0.08)" : "rgba(198,40,40,0.08)", border: `1px solid ${result.success ? "rgba(46,125,50,0.2)" : "rgba(198,40,40,0.2)"}` }}>
              {result.success ? (
                <>
                  <div style={{ fontWeight: 700, color: "#2E7D32" }}>✅ Recorded</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>{result.record.employeeName}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>{result.record.department} · {result.record.checkIn} · <strong style={{ color: result.record.status === "Late" ? "#F57C00" : "#2E7D32" }}>{result.record.status}</strong></div>
                </>
              ) : <div style={{ color: "#C62828", fontWeight: 600 }}>❌ {result.message}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
