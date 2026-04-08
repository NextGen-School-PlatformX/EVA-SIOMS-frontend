"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/lib/toast";
import { Icon } from "@/components/ui/Icon";
import { apiClient } from "@/services/apiClient";
import { Tabs, Badge, Modal } from "@/components/ui";
import { UserAvatar } from "@/components/layout/Navbar";

const API_BASE   = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const SYSTEM_ROLES = ["Admin","HR","Accountant","StoreKeeper","WorkshopEngineer","CanteenManager","Employee"];

function getTabs(role: string) {
  const tabs = [
    { id: "profile",  label: "👤 My Profile" },
    { id: "security", label: "🔒 Security"   },
    { id: "prefs",    label: "⚙️ Preferences" },
  ];
  if (role === 'Admin') {
    tabs.push({ id: "users",    label: "👥 Users"    });
    tabs.push({ id: "requests", label: "📋 Requests" });
    tabs.push({ id: "system",   label: "🛠️ System"   });
  }
  return tabs;
}

export default function Settings() {
  const { user, updateUser, refreshUser } = useAuth();
  const toast  = useToast();
  const [tab,    setTab]    = useState("profile");
  const [saving, setSaving] = useState(false);

  // ── Profile ──────────────────────────────────────────────────────────────
  const nameRef  = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Profile image
  const [imgPreview,   setImgPreview]   = useState<string | null>(null);
  const [uploadFile,   setUploadFile]   = useState<File | null>(null);
  const [uploadBusy,   setUploadBusy]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Asset custody in profile
  const [myCustody, setMyCustody] = useState<any[]>([]);
  const [custodyLoading, setCustodyLoading] = useState(false);

  // ── Security ─────────────────────────────────────────────────────────────
  const curPassRef  = useRef<HTMLInputElement>(null);
  const newPassRef  = useRef<HTMLInputElement>(null);
  const confPassRef = useRef<HTMLInputElement>(null);

  // ── Preferences (persistent settings) ────────────────────────────────────
  const [prefs, setPrefs] = useState<Record<string, string>>({
    theme: 'light', language: 'en',
    notifications_email: '1', notifications_inventory: '1', notifications_maintenance: '1',
    dashboard_layout: 'full',
  });
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaved,   setPrefsSaved]   = useState(false);

  // ── Admin: users ─────────────────────────────────────────────────────────
  const [users,         setUsers]         = useState<any[]>([]);
  const [editUser,      setEditUser]      = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const euNameRef  = useRef<HTMLInputElement>(null);
  const euEmailRef = useRef<HTMLInputElement>(null);
  const euRoleRef  = useRef<HTMLSelectElement>(null);

  // ── Admin: requests ───────────────────────────────────────────────────────
  const [requests,       setRequests]        = useState<any[]>([]);
  const [reviewReq,      setReviewReq]       = useState<any>(null);
  const [showReviewModal,setShowReviewModal] = useState(false);
  const reviewRoleRef  = useRef<HTMLSelectElement>(null);
  const reviewNotesRef = useRef<HTMLInputElement>(null);

  // ── Admin: system settings ────────────────────────────────────────────────
  const [sysSettings,    setSysSettings]    = useState<Record<string, string>>({});
  const [sysLoading,     setSysLoading]     = useState(false);

  // ─── Load data on tab change ───────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'users')    fetchUsers();
    if (tab === 'requests') fetchRequests();
    if (tab === 'prefs')    fetchPrefs();
    if (tab === 'system')   fetchSysSettings();
    if (tab === 'profile')  fetchMyCustody();
  }, [tab]);

  const fetchPrefs = async () => {
    setPrefsLoading(true);
    try {
      const data = await apiClient.get<Record<string, string>>('/settings');
      setPrefs(prev => ({ ...prev, ...data }));
    } catch {}
    finally { setPrefsLoading(false); }
  };

  const fetchSysSettings = async () => {
    setSysLoading(true);
    try {
      const data = await apiClient.get<Record<string, string>>('/settings');
      setSysSettings(data);
    } catch {}
    finally { setSysLoading(false); }
  };

  const fetchMyCustody = async () => {
    setCustodyLoading(true);
    try { setMyCustody(await apiClient.get<any[]>('/dashboard/employee/assets')); }
    catch {}
    finally { setCustodyLoading(false); }
  };

  const fetchUsers    = async () => { try { setUsers(await apiClient.get<any[]>('/auth/users')); } catch { toast("Failed to load users","error"); } };
  const fetchRequests = async () => { try { setRequests(await apiClient.get<any[]>('/auth/register-requests')); } catch { toast("Failed to load requests","error"); } };

  // ─── Profile handlers ──────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast("Please select an image file", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { toast("Image must be under 5MB", "error"); return; }
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImgPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async () => {
    if (!uploadFile) return;
    setUploadBusy(true);
    try {
      const formData = new FormData();
      formData.append('image', uploadFile);
      const token = localStorage.getItem('sioms_token');
      const res = await fetch(`${API_BASE}/api/settings/profile/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      const data = await res.json();
      updateUser({ profileImage: data.imagePath });
      toast("Profile photo updated! ✅", "success");
      setUploadFile(null);
      setImgPreview(null);
      await refreshUser();
    } catch (e: any) { toast(e.message || "Upload failed", "error"); }
    finally { setUploadBusy(false); }
  };

  const handleRemoveImage = async () => {
    if (!confirm("Remove profile photo?")) return;
    try {
      await apiClient.delete('/settings/profile/image');
      updateUser({ profileImage: null });
      setImgPreview(null);
      toast("Profile photo removed", "success");
    } catch { toast("Failed to remove", "error"); }
  };

  const handleUpdateProfile = async () => {
    const name  = nameRef.current?.value?.trim();
    const email = emailRef.current?.value?.trim();
    if (!name || name.length < 2)                               { toast("Name must be at least 2 characters","error"); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))  { toast("Valid email required","error"); return; }
    setSaving(true);
    try {
      const updated = await apiClient.put<any>('/auth/profile', { name, email });
      updateUser({ name: updated.name || name, email: updated.email || email });
      toast("Profile updated ✅","success");
    } catch (e: any) { toast(e.message || "Failed","error"); }
    finally { setSaving(false); }
  };

  // ─── Security ──────────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    const current  = curPassRef.current?.value;
    const newPass  = newPassRef.current?.value;
    const confirm  = confPassRef.current?.value;
    if (!current)                       { toast("Current password required","error"); return; }
    if (!newPass || newPass.length < 6) { toast("New password must be at least 6 chars","error"); return; }
    if (newPass !== confirm)            { toast("Passwords do not match","error"); return; }
    setSaving(true);
    try {
      await apiClient.put('/auth/profile', { currentPassword: current, newPassword: newPass });
      toast("Password changed ✅","success");
      [curPassRef, newPassRef, confPassRef].forEach(r => { if (r.current) r.current.value = ''; });
    } catch (e: any) { toast(e.message || "Failed","error"); }
    finally { setSaving(false); }
  };

  // ─── Preferences ───────────────────────────────────────────────────────────
  const setPref = (key: string, val: string) => setPrefs(p => ({ ...p, [key]: val }));

  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      await apiClient.post('/settings', { settings: prefs, scope: 'user' });
      setPrefsSaved(true);
      toast("Preferences saved ✅","success");
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch { toast("Failed to save","error"); }
    finally { setSaving(false); }
  };

  // ─── System settings ───────────────────────────────────────────────────────
  const setSysPref = (key: string, val: string) => setSysSettings(p => ({ ...p, [key]: val }));

  const handleSaveSysSettings = async () => {
    setSaving(true);
    try {
      await apiClient.post('/settings', { settings: sysSettings, scope: 'system' });
      toast("System settings saved ✅","success");
    } catch { toast("Failed","error"); }
    finally { setSaving(false); }
  };

  // ─── Admin: users ──────────────────────────────────────────────────────────
  const openEditUser = (u: any) => {
    setEditUser(u); setShowUserModal(true);
    setTimeout(() => { if(euNameRef.current) euNameRef.current.value=u.name; if(euEmailRef.current) euEmailRef.current.value=u.email; if(euRoleRef.current) euRoleRef.current.value=u.role; }, 50);
  };
  const handleSaveUser = async () => {
    if (!editUser) return;
    const name=euNameRef.current?.value?.trim(), email=euEmailRef.current?.value?.trim(), role=euRoleRef.current?.value;
    if (!name||name.length<2) { toast("Name required","error"); return; }
    if (!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("Valid email required","error"); return; }
    try { await apiClient.put(`/auth/users/${editUser.id}`, { name, email, role }); toast("User updated","success"); setShowUserModal(false); fetchUsers(); }
    catch (e: any) { toast(e.message||"Failed","error"); }
  };
  const handleToggleActive = async (u: any) => {
    const action = u.is_active ? 'deactivate' : 'activate';
    if (!confirm(`${action.charAt(0).toUpperCase()+action.slice(1)} "${u.name}"?`)) return;
    try { await apiClient.put(`/auth/users/${u.id}`, { is_active: !u.is_active }); toast(`User ${action}d`,"success"); fetchUsers(); }
    catch (e: any) { toast(e.message||"Failed","error"); }
  };
  const handleDeleteUser = async (u: any) => {
    if (!confirm(`Permanently delete "${u.name}"?`)) return;
    try { await apiClient.delete(`/auth/users/${u.id}`); toast(`${u.name} deleted`,"success"); fetchUsers(); }
    catch (e: any) { toast(e.message||"Failed","error"); }
  };

  // ─── Admin: review requests ───────────────────────────────────────────────
  const openReviewModal = (req: any) => {
    setReviewReq(req); setShowReviewModal(true);
    setTimeout(() => { if(reviewRoleRef.current) reviewRoleRef.current.value=req.requested_role; if(reviewNotesRef.current) reviewNotesRef.current.value=''; }, 50);
  };
  const handleApproveRequest = async () => {
    if (!reviewReq) return;
    try {
      await apiClient.post(`/auth/register-requests/${reviewReq.id}/approve`, { role: reviewRoleRef.current?.value, adminNotes: reviewNotesRef.current?.value });
      toast(`✅ ${reviewReq.name} approved!`,"success"); setShowReviewModal(false); fetchRequests();
    } catch (e: any) { toast(e.message||"Failed","error"); }
  };
  const handleRejectRequest = async () => {
    if (!reviewReq || !confirm(`Reject "${reviewReq.name}"?`)) return;
    try { await apiClient.post(`/auth/register-requests/${reviewReq.id}/reject`, { adminNotes: reviewNotesRef.current?.value }); toast("Rejected","info"); setShowReviewModal(false); fetchRequests(); }
    catch (e: any) { toast(e.message||"Failed","error"); }
  };

  const tabs = getTabs(user?.role || '');
  const pendingRequests = requests.filter(r => r.status === 'Pending' || r.status === 'Verified');

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <Tabs tabs={tabs.map(t => t.id==='requests' && pendingRequests.length>0 ? { ...t, label:`📋 Requests (${pendingRequests.length})` } : t)}
        active={tab} onChange={setTab} />

      {/* ══════ MY PROFILE ══════ */}
      {tab === "profile" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Left: avatar + personal info */}
          <div className="card">
            <div className="card-header"><span className="card-title">Personal Information</span></div>
            <div style={{ padding: "0 0 20px", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Avatar upload section */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px", background: "var(--surface2)", borderRadius: 12 }}>
                <div style={{ position: "relative" }}>
                  {imgPreview ? (
                    <img src={imgPreview} alt="preview" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid var(--primary)" }} />
                  ) : (
                    <UserAvatar user={user!} size={72} />
                  )}
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: "50%", background: "#0055A5", color: "#fff", border: "2px solid var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12 }}>
                    ✏️
                  </button>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{user?.name}</div>
                  <div style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>{user?.role}</div>
                  <div style={{ color: "var(--text3)", fontSize: 12 }}>{user?.email}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button className="btn btn-xs btn-secondary" onClick={() => fileInputRef.current?.click()}>📷 Change Photo</button>
                    {user?.profileImage && <button className="btn btn-xs btn-danger" onClick={handleRemoveImage}>Remove</button>}
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />
              </div>

              {/* Photo upload preview */}
              {uploadFile && (
                <div style={{ padding: 12, background: "rgba(0,85,165,0.06)", borderRadius: 8, border: "1px solid rgba(0,85,165,0.15)", display: "flex", gap: 12, alignItems: "center" }}>
                  <img src={imgPreview!} alt="new" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{uploadFile.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{(uploadFile.size/1024).toFixed(0)} KB · Ready to upload</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={handleUploadImage} disabled={uploadBusy}>
                    {uploadBusy ? "Uploading..." : "✅ Save Photo"}
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setUploadFile(null); setImgPreview(null); }}>✕</button>
                </div>
              )}

              <div className="form-group"><label className="form-label">Full Name</label>
                <input ref={nameRef} className="form-input" defaultValue={user?.name} />
              </div>
              <div className="form-group"><label className="form-label">Email Address</label>
                <input ref={emailRef} className="form-input" type="email" defaultValue={user?.email} />
              </div>
              <div className="form-group"><label className="form-label">Role</label>
                <input className="form-input" value={user?.role || ''} disabled style={{ opacity: 0.6 }} readOnly />
              </div>
              <button className="btn btn-primary" onClick={handleUpdateProfile} disabled={saving} style={{ alignSelf: "flex-start" }}>
                {saving ? "Saving..." : "💾 Save Changes"}
              </button>
            </div>
          </div>

          {/* Right: permissions + asset custody */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">🔑 Access Permissions</span></div>
              <div style={{ padding: "0 0 16px" }}>
                {(user?.permissions || []).map(p => (
                  <div key={p} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 14, textTransform: "capitalize", fontWeight: 500 }}>{p.charAt(0).toUpperCase()+p.slice(1)}</span>
                    <span style={{ fontSize: 11, background: "rgba(46,125,50,0.1)", color: "var(--success)", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>✓ Access</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Asset custody summary */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📦 My Asset Custody</span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>{myCustody.filter(a => a.status === 'In Use').length} in use</span>
              </div>
              {custodyLoading ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>Loading...</div>
              ) : myCustody.length === 0 ? (
                <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No assets assigned to your account.</div>
              ) : (
                <div className="table-wrap" style={{ maxHeight: 240, overflowY: "auto" }}>
                  <table>
                    <thead><tr><th>Asset</th><th>Issued</th><th>Return</th><th>Status</th></tr></thead>
                    <tbody>
                      {myCustody.map((a, i) => (
                        <tr key={i}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                            {a.category && <div style={{ fontSize: 11, color: "var(--text3)" }}>{a.category}</div>}
                          </td>
                          <td style={{ fontSize: 12 }}>{a.assign_date || a.issued_date || "—"}</td>
                          <td style={{ fontSize: 12, color: a.return_date ? "var(--text2)" : "var(--text3)" }}>{a.return_date || "—"}</td>
                          <td>
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 600,
                              background: a.status === 'In Use' ? "rgba(245,124,0,0.12)" : "rgba(46,125,50,0.12)",
                              color: a.status === 'In Use' ? "#F57C00" : "#2E7D32" }}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════ SECURITY ══════ */}
      {tab === "security" && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-header"><span className="card-title">🔒 Change Password</span></div>
          <div style={{ padding: "0 0 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group"><label className="form-label">Current Password</label>
              <input ref={curPassRef} className="form-input" type="password" placeholder="••••••••" />
            </div>
            <div className="form-group"><label className="form-label">New Password (min 6 chars)</label>
              <input ref={newPassRef} className="form-input" type="password" placeholder="Enter new password" />
            </div>
            <div className="form-group"><label className="form-label">Confirm New Password</label>
              <input ref={confPassRef} className="form-input" type="password" placeholder="Repeat new password" />
            </div>
            <button className="btn btn-primary" onClick={handleChangePassword} disabled={saving} style={{ alignSelf: "flex-start" }}>
              {saving ? "Changing..." : "🔑 Change Password"}
            </button>
          </div>
        </div>
      )}

      {/* ══════ PREFERENCES ══════ */}
      {tab === "prefs" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">🎨 Display Preferences</span></div>
            <div style={{ padding: "0 0 20px", display: "flex", flexDirection: "column", gap: 18 }}>
              {prefsLoading ? <div style={{ padding: 20, textAlign: "center", color: "var(--text3)" }}>Loading...</div> : <>
                <div className="form-group"><label className="form-label">Theme</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["light","dark"].map(t => (
                      <button key={t} onClick={() => setPref('theme', t)}
                        className={`btn btn-sm ${prefs.theme === t ? "btn-primary" : "btn-secondary"}`}
                        style={{ flex: 1 }}>
                        {t === 'light' ? '☀️ Light' : '🌙 Dark'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group"><label className="form-label">Language</label>
                  <select className="form-input" value={prefs.language || 'en'} onChange={e => setPref('language', e.target.value)}>
                    <option value="en">🇬🇧 English</option>
                    <option value="ar">🇸🇦 Arabic</option>
                  </select>
                </div>

                <div className="form-group"><label className="form-label">Dashboard Layout</label>
                  <select className="form-input" value={prefs.dashboard_layout || 'full'} onChange={e => setPref('dashboard_layout', e.target.value)}>
                    <option value="full">Full — All modules</option>
                    <option value="compact">Compact — KPIs only</option>
                    <option value="charts">Charts-focused</option>
                  </select>
                </div>
              </>}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">🔔 Notifications</span></div>
            <div style={{ padding: "0 0 20px", display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                ["notifications_email",       "Email Notifications",          "Receive alerts via email"],
                ["notifications_inventory",   "Low Stock Alerts",             "Notify when items fall below minimum"],
                ["notifications_maintenance", "Maintenance Due Alerts",       "Notify when equipment is due"],
              ].map(([key, label, desc]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "var(--text3)" }}>{desc}</div>
                  </div>
                  <button onClick={() => setPref(key, prefs[key] === '1' ? '0' : '1')}
                    style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                      background: prefs[key] === '1' ? "#0055A5" : "var(--surface2)",
                      position: "relative", transition: "background 0.2s" }}>
                    <span style={{ position: "absolute", top: 2, left: prefs[key] === '1' ? 22 : 2,
                      width: 20, height: 20, borderRadius: "50%", background: prefs[key] === '1' ? "#fff" : "var(--text3)",
                      transition: "left 0.2s", display: "block" }} />
                  </button>
                </div>
              ))}
              <button className="btn btn-primary" onClick={handleSavePrefs} disabled={saving} style={{ alignSelf: "flex-start", marginTop: 16 }}>
                {prefsSaved ? "✅ Saved!" : saving ? "Saving..." : "💾 Save Preferences"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ ADMIN: USERS ══════ */}
      {tab === "users" && (
        <div className="card">
          <div className="card-header"><span className="card-title">User Accounts ({users.length})</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{u.name[0]}</div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{u.name} {u.id === user?.id && <span style={{ fontSize: 11, color: "var(--primary)" }}>(you)</span>}</div>
                          <div style={{ fontSize: 11, color: "var(--text3)" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 12, fontWeight: 600, background: "rgba(0,85,165,0.1)", color: "var(--primary)", padding: "2px 8px", borderRadius: 10 }}>{u.role}</span></td>
                    <td><Badge status={u.is_active ? 'Active' : 'Inactive'} /></td>
                    <td style={{ fontSize: 12, color: "var(--text3)" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-xs btn-secondary" onClick={() => openEditUser(u)}><Icon name="edit" size={12} /></button>
                        <button className="btn btn-xs btn-secondary" onClick={() => handleToggleActive(u)} style={{ color: u.is_active ? "var(--danger)" : "var(--success)" }}>
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                        {u.id !== user?.id && <button className="btn btn-xs btn-danger" onClick={() => handleDeleteUser(u)}><Icon name="trash" size={12} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════ ADMIN: REQUESTS ══════ */}
      {tab === "requests" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Registration Requests ({requests.length})</span>
            {pendingRequests.length > 0 && <span style={{ fontSize: 12, background: "rgba(198,40,40,0.1)", color: "var(--danger)", padding: "4px 10px", borderRadius: 10, fontWeight: 600 }}>{pendingRequests.length} Pending</span>}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Applicant</th><th>Role</th><th>Dept.</th><th>Verified</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {requests.length === 0 ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No requests yet</td></tr> : requests.map(r => (
                  <tr key={r.id} style={{ background: (r.status==='Pending'||r.status==='Verified') ? "rgba(255,152,0,0.04)" : undefined }}>
                    <td><div style={{ fontWeight: 500 }}>{r.name}</div><div style={{ fontSize: 11, color: "var(--text3)" }}>{r.email}</div></td>
                    <td><span style={{ fontSize: 12, fontWeight: 600, background: "rgba(0,85,165,0.1)", color: "var(--primary)", padding: "2px 8px", borderRadius: 10 }}>{r.requested_role}</span></td>
                    <td style={{ fontSize: 13 }}>{r.department || "—"}</td>
                    <td style={{ textAlign: "center" }}>{r.email_verified ? '✅' : '❌'}</td>
                    <td><Badge status={r.status} /></td>
                    <td style={{ fontSize: 12, color: "var(--text3)" }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                      {(r.status==='Pending'||r.status==='Verified') && <button className="btn btn-xs btn-primary" onClick={() => openReviewModal(r)}>Review</button>}
                      {r.status==='Approved' && <span style={{ fontSize: 12, color: "var(--success)" }}>✓ Approved</span>}
                      {r.status==='Rejected' && <span style={{ fontSize: 12, color: "var(--danger)" }}>✗ Rejected</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════ ADMIN: SYSTEM SETTINGS ══════ */}
      {tab === "system" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">🏢 Organization</span></div>
            <div style={{ padding: "0 0 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {sysLoading ? <div style={{ padding: 20, textAlign: "center", color: "var(--text3)" }}>Loading...</div> : <>
                <div className="form-group"><label className="form-label">Organization Name</label>
                  <input className="form-input" value={sysSettings.org_name || ''} onChange={e => setSysPref('org_name', e.target.value)} placeholder="SIOMS Organization" />
                </div>
                <div className="form-group"><label className="form-label">Timezone</label>
                  <select className="form-input" value={sysSettings.timezone || 'Africa/Cairo'} onChange={e => setSysPref('timezone', e.target.value)}>
                    <option value="Africa/Cairo">Africa/Cairo (EET +2)</option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Riyadh">Asia/Riyadh (+3)</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Currency</label>
                  <select className="form-input" value={sysSettings.currency || 'EGP'} onChange={e => setSysPref('currency', e.target.value)}>
                    <option value="EGP">EGP — Egyptian Pound</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="SAR">SAR — Saudi Riyal</option>
                  </select>
                </div>
              </>}
              <button className="btn btn-primary" onClick={handleSaveSysSettings} disabled={saving} style={{ alignSelf: "flex-start" }}>
                {saving ? "Saving..." : "💾 Save"}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">⏰ Attendance Settings</span></div>
            <div style={{ padding: "0 0 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="form-group"><label className="form-label">GPS Radius (meters)</label>
                <input className="form-input" type="number" value={sysSettings.gps_radius || '200'} onChange={e => setSysPref('gps_radius', e.target.value)} />
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Work Start</label>
                  <input className="form-input" type="time" value={sysSettings.work_start || '08:00'} onChange={e => setSysPref('work_start', e.target.value)} />
                </div>
                <div className="form-group"><label className="form-label">Work End</label>
                  <input className="form-input" type="time" value={sysSettings.work_end || '16:00'} onChange={e => setSysPref('work_end', e.target.value)} />
                </div>
              </div>
              <div className="form-group"><label className="form-label">Late Grace Period (min)</label>
                <input className="form-input" type="number" value={sysSettings.late_grace || '15'} onChange={e => setSysPref('late_grace', e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={handleSaveSysSettings} disabled={saving} style={{ alignSelf: "flex-start" }}>
                {saving ? "Saving..." : "💾 Save"}
              </button>
            </div>
          </div>

          {/* Payroll tax manager — full width */}
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card-header"><span className="card-title">💰 Payroll Tax & Deduction Rates</span></div>
            <div style={{ padding: "0 0 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(0,85,165,0.06)", border: "1px solid rgba(0,85,165,0.15)", fontSize: 13 }}>
                Applied globally to <strong>Gross Salary</strong> (Base + Overtime + Bonus) unless overridden per-employee.
              </div>
              <PayrollTaxManager />
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}
      <Modal open={showUserModal} onClose={() => setShowUserModal(false)} title={`Edit User — ${editUser?.name||''}`}
        footer={<><button className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSaveUser}>Save</button></>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group"><label className="form-label">Full Name</label><input ref={euNameRef} className="form-input" /></div>
          <div className="form-group"><label className="form-label">Email</label><input ref={euEmailRef} className="form-input" type="email" /></div>
          <div className="form-group"><label className="form-label">Role</label>
            <select ref={euRoleRef} className="form-input">{SYSTEM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
          </div>
        </div>
      </Modal>

      <Modal open={showReviewModal} onClose={() => setShowReviewModal(false)} title="Review Registration Request"
        footer={<><button className="btn btn-danger" onClick={handleRejectRequest}>Reject</button><button className="btn btn-primary" onClick={handleApproveRequest}>✅ Approve & Send Credentials</button></>}>
        {reviewReq && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: 16, background: "var(--surface2)", borderRadius: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{reviewReq.name}</div>
              <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>{reviewReq.email}</div>
              {reviewReq.department && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>Dept: {reviewReq.department}</div>}
              {reviewReq.reason && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>Reason: {reviewReq.reason}</div>}
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, color: reviewReq.email_verified ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                  {reviewReq.email_verified ? '✅ Email Verified' : '❌ Email NOT Verified'}
                </span>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Assign Role</label>
              <select ref={reviewRoleRef} className="form-input">{SYSTEM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
            </div>
            <div className="form-group"><label className="form-label">Admin Notes</label>
              <input ref={reviewNotesRef} className="form-input" placeholder="Optional notes..." />
            </div>
            <div style={{ padding: 12, background: "rgba(0,85,165,0.06)", borderRadius: 8, fontSize: 12, color: "var(--text2)" }}>
              💡 A random password will be generated and sent to <strong>{reviewReq.email}</strong>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Payroll Tax Manager subcomponent ─────────────────────────────────────────
function PayrollTaxManager() {
  const toast = useToast();
  const [taxes,   setTaxes]   = useState<{name:string;rate:number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    apiClient.get<any>('/hr/payroll-settings')
      .then(r => setTaxes(r.payroll_taxes || []))
      .catch(() => setTaxes([{name:"Income Tax",rate:10},{name:"Social Insurance",rate:5}]))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    for (const t of taxes) {
      if (!t.name.trim()) { toast("Each entry needs a name","error"); return; }
      if (isNaN(t.rate) || t.rate < 0) { toast(`Invalid rate for "${t.name}"`,"error"); return; }
    }
    setSaving(true);
    try { await apiClient.post('/hr/payroll-settings', { payroll_taxes: taxes }); toast("Payroll settings saved ✅","success"); }
    catch (e: any) { toast(e.message||"Failed","error"); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding:16,color:"var(--text3)",fontSize:13 }}>Loading...</div>;
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
      {taxes.map((t,i) => (
        <div key={i} style={{ display:"flex",gap:8,alignItems:"center" }}>
          <input className="form-input" style={{ flex:2 }} value={t.name} placeholder="e.g., Income Tax"
            onChange={e => { const a=[...taxes]; a[i]={...a[i],name:e.target.value}; setTaxes(a); }} />
          <div style={{ display:"flex",alignItems:"center",gap:4,flex:1 }}>
            <input className="form-input" type="number" min="0" max="100" step="0.5" style={{ width:80 }} value={t.rate}
              onChange={e => { const a=[...taxes]; a[i]={...a[i],rate:parseFloat(e.target.value)||0}; setTaxes(a); }} />
            <span style={{ fontSize:13,color:"var(--text3)" }}>%</span>
          </div>
          <button onClick={() => setTaxes(taxes.filter((_,j)=>j!==i))}
            style={{ background:"rgba(198,40,40,0.1)",color:"#C62828",border:"1px solid rgba(198,40,40,0.2)",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontSize:12 }}>✕</button>
        </div>
      ))}
      <div style={{ display:"flex",gap:8 }}>
        <button onClick={() => setTaxes([...taxes,{name:"",rate:0}])}
          style={{ background:"rgba(0,85,165,0.08)",color:"#0055A5",border:"1px solid rgba(0,85,165,0.2)",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:13,fontWeight:600 }}>
          + Add Field
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ marginLeft:"auto" }}>
          {saving ? "Saving..." : "💾 Save Tax Settings"}
        </button>
      </div>
    </div>
  );
}
