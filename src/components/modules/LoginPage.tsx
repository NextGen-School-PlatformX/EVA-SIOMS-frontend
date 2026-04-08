"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/authService";
import { useToast } from "@/lib/toast";

const ROLES = ["Employee","HR","Accountant","StoreKeeper","WorkshopEngineer","CanteenManager"];
const DEPARTMENTS = ["HR","Finance","IT","Operations","Workshop","Inventory","Canteen","Security","Admin","Maintenance"];

type Step = 'login' | 'register' | 'verify';

const features = [
  { icon: "attendance", text: "Smart QR attendance tracking" },
  { icon: "inventory",  text: "Real-time inventory management" },
  { icon: "workshop",   text: "Workshop & equipment control" },
  { icon: "payroll",    text: "Automated payroll & payslips" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<Step>('login');
  const [loading, setLoading] = useState(false);

  // Login state
  const [email, setEmail]       = useState("admin@school.edu.eg");
  const [password, setPassword] = useState("admin123");
  const [showPass, setShowPass] = useState(false);

  // Register request state
  const [regName,   setRegName]   = useState('');
  const [regEmail,  setRegEmail]  = useState('');
  const [regRole,   setRegRole]   = useState('Employee');
  const [regDept,   setRegDept]   = useState('');
  const [regPhone,  setRegPhone]  = useState('');
  const [regReason, setRegReason] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  // Verification state
  const [verifyCode, setVerifyCode] = useState('');

  // ── Login ──
  const handleLogin = async () => {
    if (!email.trim()) { toast("Email is required","error"); return; }
    if (!password)     { toast("Password is required","error"); return; }
    setLoading(true);
    try {
      const response = await authService.login(email.trim(), password);
      login(response.user, response.token);
      toast(`Welcome back, ${response.user.name}!`, "success");
    } catch (e: any) {
      toast(e.message || "Invalid email or password", "error");
    } finally { setLoading(false); }
  };

  // ── Register Request ──
  const handleRegisterRequest = async () => {
    if (!regName.trim() || regName.length < 2) { toast("Full name is required (min 2 chars)","error"); return; }
    if (!regEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) { toast("Valid email is required","error"); return; }
    if (!regRole) { toast("Please select a role","error"); return; }
    setLoading(true);
    try {
      await authService.registerRequest({ name: regName.trim(), email: regEmail.trim().toLowerCase(), requestedRole: regRole, department: regDept, phone: regPhone, reason: regReason });
      setPendingEmail(regEmail.trim().toLowerCase());
      toast("Request submitted! Check your email for a verification code.","success");
      setStep('verify');
    } catch (e: any) {
      toast(e.message || "Failed to submit request","error");
    } finally { setLoading(false); }
  };

  // ── Verify Email ──
  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) { toast("Enter the 6-digit code","error"); return; }
    setLoading(true);
    try {
      await authService.verifyEmail(pendingEmail, verifyCode);
      toast("Email verified! Your request is now pending admin approval. You'll receive credentials by email once approved.","success");
      setStep('login');
    } catch (e: any) {
      toast(e.message || "Invalid or expired code","error");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    try {
      await authService.resendVerification(pendingEmail);
      toast("New code sent to your email","success");
    } catch (e: any) { toast(e.message || "Failed","error"); }
  };

  return (
    <div className="login-page">
      {/* Left panel */}
      <div className="login-left">
        <div style={{ maxWidth: 480 }}>
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:48 }}>
            <div style={{ width:52, height:52, background:"rgba(255,255,255,0.2)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="workshop" size={28} style={{ color:"white" }} />
            </div>
            <div>
              <div style={{ fontFamily:"Sora, sans-serif", fontWeight:700, fontSize:20 }}>SIOMS</div>
              <div style={{ opacity:0.7, fontSize:12, letterSpacing:1 }}>SCHOOL INTERNAL OPERATIONS</div>
            </div>
          </div>
          <h1 style={{ fontSize:42, lineHeight:1.2, marginBottom:20, fontWeight:700 }}>
            Enterprise School<br />
            <span style={{ color:"rgba(255,255,255,0.6)" }}>Operations Hub</span>
          </h1>
          <p style={{ fontSize:16, opacity:0.8, lineHeight:1.6, marginBottom:40 }}>
            A secure, role-based management platform for all internal school operations.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {features.map(f => (
              <div key={f.text} style={{ display:"flex", alignItems:"center", gap:12, opacity:0.9 }}>
                <div style={{ width:32, height:32, background:"rgba(255,255,255,0.15)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon name={f.icon} size={16} style={{ color:"white" }} />
                </div>
                <span style={{ fontSize:15 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-card">

          {/* ── TAB SWITCHER (only for login / register) ── */}
          {step !== 'verify' && (
            <div style={{ display:"flex", gap:4, background:"var(--surface2)", padding:4, borderRadius:10, marginBottom:28 }}>
              <button onClick={() => setStep('login')} style={{ flex:1, padding:"9px", border:"none", borderRadius:7, cursor:"pointer", fontWeight:600, fontSize:13,
                background: step==='login' ? "var(--primary)" : "transparent", color: step==='login' ? "white" : "var(--text3)", transition:"all 0.2s" }}>
                Sign In
              </button>
              <button onClick={() => setStep('register')} style={{ flex:1, padding:"9px", border:"none", borderRadius:7, cursor:"pointer", fontWeight:600, fontSize:13,
                background: step==='register' ? "var(--primary)" : "transparent", color: step==='register' ? "white" : "var(--text3)", transition:"all 0.2s" }}>
                Request Access
              </button>
            </div>
          )}

          {/* ──────────────── LOGIN ──────────────── */}
          {step === 'login' && (
            <>
              <div style={{ marginBottom:24 }}>
                <h2 style={{ fontFamily:"Sora, sans-serif", fontSize:26, fontWeight:700, color:"var(--text)", marginBottom:6 }}>Welcome Back</h2>
                <p style={{ color:"var(--text3)", fontSize:14 }}>Sign in with your SIOMS credentials</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="you@school.edu.eg" />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ position:"relative" }}>
                    <input className="form-input" type={showPass ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      style={{ paddingRight:40 }} placeholder="••••••••" />
                    <button onClick={() => setShowPass(v => !v)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--text3)" }}>
                      <Icon name={showPass ? "eye" : "eye"} size={16} />
                    </button>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ justifyContent:"center", padding:"13px", marginTop:4 }}
                  onClick={handleLogin} disabled={loading}>
                  {loading ? "Signing in..." : "Sign In to SIOMS"}
                </button>
              </div>

              <div style={{ marginTop:20, padding:14, background:"var(--surface2)", borderRadius:10, border:"1px solid var(--border)" }}>
                <div style={{ fontSize:12, color:"var(--text3)", marginBottom:8, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Demo Accounts</div>
                {[
                  ["admin@school.edu.eg",    "Admin",            "#0055A5"],
                  ["hr@school.edu.eg",        "HR",               "#2E7D32"],
                  ["finance@school.edu.eg",   "Accountant",       "#7B1FA2"],
                  ["workshop@school.edu.eg",  "WorkshopEngineer", "#F57C00"],
                  ["store@school.edu.eg",     "StoreKeeper",      "#1565C0"],
                  ["canteen@school.edu.eg",   "CanteenManager",   "#C62828"],
                ].map(([em, role, color]) => (
                  <div key={em} onClick={() => { setEmail(em); setPassword('admin123'); }}
                    style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 8px", borderRadius:6, cursor:"pointer", marginBottom:2 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--accent2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize:12, color:"var(--text2)" }}>{em}</span>
                    <span style={{ fontSize:11, fontWeight:600, color, background:`${color}15`, padding:"2px 6px", borderRadius:4 }}>{role}</span>
                  </div>
                ))}
                <div style={{ fontSize:11, color:"var(--text3)", marginTop:6 }}>Password for all: <code style={{ background:"var(--border)", padding:"1px 4px", borderRadius:3 }}>admin123</code></div>
              </div>
            </>
          )}

          {/* ──────────────── REGISTER REQUEST ──────────────── */}
          {step === 'register' && (
            <>
              <div style={{ marginBottom:20 }}>
                <h2 style={{ fontFamily:"Sora, sans-serif", fontSize:24, fontWeight:700, color:"var(--text)", marginBottom:6 }}>Request Access</h2>
                <p style={{ color:"var(--text3)", fontSize:13, lineHeight:1.5 }}>
                  Submit a registration request. An admin will review it and send you your login credentials by email.
                </p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" placeholder="Your full name" value={regName} onChange={e => setRegName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Work Email *</label>
                  <input className="form-input" type="email" placeholder="you@school.edu.eg" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Requested Role *</label>
                    <select className="form-input" value={regRole} onChange={e => setRegRole(e.target.value)}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select className="form-input" value={regDept} onChange={e => setRegDept(e.target.value)}>
                      <option value="">— Select —</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input className="form-input" placeholder="+20 XXX XXX XXXX" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason / Notes</label>
                  <input className="form-input" placeholder="Why do you need access?" value={regReason} onChange={e => setRegReason(e.target.value)} />
                </div>
                <button className="btn btn-primary" style={{ justifyContent:"center", padding:"13px" }}
                  onClick={handleRegisterRequest} disabled={loading}>
                  {loading ? "Submitting..." : "Submit Request →"}
                </button>
              </div>
            </>
          )}

          {/* ──────────────── EMAIL VERIFY ──────────────── */}
          {step === 'verify' && (
            <>
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(0,85,165,0.1)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                  <Icon name="bell" size={24} style={{ color:"var(--primary)" }} />
                </div>
                <h2 style={{ fontFamily:"Sora, sans-serif", fontSize:22, fontWeight:700, color:"var(--text)", marginBottom:6 }}>Check Your Email</h2>
                <p style={{ color:"var(--text3)", fontSize:13, lineHeight:1.5 }}>
                  We sent a 6-digit code to<br /><strong style={{ color:"var(--text)" }}>{pendingEmail}</strong>
                </p>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div className="form-group">
                  <label className="form-label">Verification Code</label>
                  <input className="form-input" placeholder="000000" maxLength={6} value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value.replace(/\D/g,''))}
                    style={{ textAlign:"center", fontSize:24, fontWeight:700, letterSpacing:8, fontFamily:"monospace" }} />
                </div>
                <button className="btn btn-primary" style={{ justifyContent:"center", padding:"13px" }}
                  onClick={handleVerify} disabled={loading}>
                  {loading ? "Verifying..." : "Verify Email"}
                </button>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                  <button style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)" }} onClick={handleResend}>
                    Resend code
                  </button>
                  <button style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)" }} onClick={() => setStep('register')}>
                    ← Go back
                  </button>
                </div>
              </div>

              <div style={{ marginTop:20, padding:14, background:"rgba(0,85,165,0.06)", borderRadius:10, border:"1px solid rgba(0,85,165,0.15)" }}>
                <p style={{ fontSize:12, color:"var(--text3)", margin:0, lineHeight:1.5 }}>
                  📬 After verifying, an administrator will review your request. Once approved, your login credentials will be sent to your email automatically.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
