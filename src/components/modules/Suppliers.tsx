"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SearchBar, Pagination, Badge, Modal, KPICard } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { Icon } from "@/components/ui/Icon";
import { apiClient } from "@/services/apiClient";

const SUPPLIER_TABS = [
  { id: "list", label: "Supplier List", icon: "suppliers" },
  { id: "orders", label: "Purchase Orders", icon: "inventory" },
  { id: "analytics", label: "Analytics", icon: "dashboard" }
];

export default function Suppliers() {
  const toast = useToast();
  const [tab, setTab] = useState("list");

  // Supplier List State
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [totalSuppliers, setTotalSuppliers] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const perPage = 10;

  // Supplier Profile State
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierPurchases, setSupplierPurchases] = useState<any[]>([]);
  const [supplierItems, setSupplierItems] = useState<any[]>([]);
  const [showProfile, setShowProfile] = useState(false);

  // Purchase Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [poLoading, setPoLoading] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  // PO Form State
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poItems, setPoItems] = useState<any[]>([{ inventory_item_id: "", quantity: 1, price: 0 }]);
  const [poAuthorizedBy, setPoAuthorizedBy] = useState("");
  const [editingPO, setEditingPO] = useState<any>(null);

  // Analytics State
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Add Supplier State
  const [showAddModal, setShowAddModal] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const catRef = useRef<HTMLSelectElement>(null);

  // ─── Fetches ──────────────────────────────────────────────────────────────────

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const [res, sum] = await Promise.all([
        apiClient.get<any>(`/suppliers?search=${search}&page=${page}&limit=${perPage}`),
        apiClient.get<any>('/suppliers/summary')
      ]);
      setSuppliers(res.data);
      setTotalSuppliers(res.total);
      setSummary(sum);
    } catch { toast("Failed to load suppliers", "error"); }
    finally { setLoading(false); }
  }, [search, page]);

  const fetchOrders = async () => {
    setPoLoading(true);
    try {
      const res = await apiClient.get<any[]>('/purchase-orders');
      setOrders(res);
    } catch { toast("Failed to load purchase orders", "error"); }
    finally { setPoLoading(false); }
  };

  const fetchInventory = async () => {
    try {
      const res = await apiClient.get<any>('/inventory?limit=1000');
      setInventoryItems(res.data);
    } catch { }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await apiClient.get<any>('/suppliers/analytics');
      setAnalytics(res);
    } catch { toast("Failed to load analytics", "error"); }
    finally { setAnalyticsLoading(false); }
  };

  const handleViewProfile = async (supplier: any) => {
    setSelectedSupplier(supplier);
    setShowProfile(true);
    try {
      const [purchases, items] = await Promise.all([
        apiClient.get<any[]>(`/suppliers/${supplier.id}/purchases`),
        apiClient.get<any[]>(`/suppliers/${supplier.id}/items`)
      ]);
      setSupplierPurchases(purchases);
      setSupplierItems(items);
    } catch { toast("Failed to load supplier details", "error"); }
  };

  useEffect(() => { if (tab === "list") fetchSuppliers(); }, [tab, fetchSuppliers]);
  useEffect(() => { if (tab === "orders") { fetchOrders(); fetchInventory(); } }, [tab]);
  useEffect(() => { if (tab === "analytics") fetchAnalytics(); }, [tab]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleAddSupplier = async () => {
    const name = nameRef.current?.value.trim();
    if (!name) { toast("Name is required", "error"); return; }
    try {
      await apiClient.post('/suppliers', {
        name,
        contact: contactRef.current?.value,
        email: emailRef.current?.value,
        category: catRef.current?.value
      });
      toast("Supplier added successfully", "success");
      setShowAddModal(false);
      fetchSuppliers();
    } catch (e: any) { toast(e.message || "Failed to add supplier", "error"); }
  };

  const handleCreatePO = async () => {
    if (!poSupplierId) { toast("Please select a supplier", "error"); return; }
    const validItems = poItems.filter(i => i.inventory_item_id && i.quantity > 0);
    if (!validItems.length) { toast("Add at least one item", "error"); return; }

    try {
      if (editingPO) {
        await apiClient.put(`/purchase-orders/${editingPO.id}`, { items: validItems });
        toast("Purchase Order updated successfully", "success");
      } else {
        await apiClient.post('/purchase-orders', {
          supplierId: poSupplierId,
          items: validItems,
          authorizedBy: poAuthorizedBy
        });
        toast("Purchase Order created successfully", "success");
      }
      setShowPOModal(false);
      setPoItems([{ inventory_item_id: "", quantity: 1, price: 0 }]);
      setPoSupplierId("");
      setEditingPO(null);
      fetchOrders();
    } catch (e: any) { toast(e.message || "Failed to save PO", "error"); }
  };

  const openEditPO = (po: any) => {
    setEditingPO(po);
    setPoSupplierId(po.supplier_id.toString());
    setPoItems(po.items.map((i: any) => ({ inventory_item_id: i.inventory_item_id.toString(), quantity: i.quantity, price: i.price })));
    setPoAuthorizedBy(po.authorized_by);
    setShowPOModal(true);
  };

  const handleUpdatePOStatus = async (id: number, status: string) => {
    try {
      await apiClient.put(`/purchase-orders/${id}/status`, { status });
      toast(`PO status updated to ${status}`, "success");
      fetchOrders();
      if (tab === "list") fetchSuppliers(); // Update supplier sums if delivered
    } catch (e: any) { toast(e.message || "Failed to update status", "error"); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fade-in">
      {/* Sub Header / Tabs */}
      <div style={{ display: "flex", gap: 30, marginBottom: 25, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
        {SUPPLIER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "none", border: "none", padding: "8px 0", cursor: "pointer",
              fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
              color: tab === t.id ? "#0055A5" : "var(--text3)",
              borderBottom: tab === t.id ? "3px solid #0055A5" : "3px solid transparent",
              marginBottom: -13, transition: "all 0.2s"
            }}
          >
            <Icon name={t.icon as any} size={18} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ SUPPLIER LIST TAB ═══════════════ */}
      {tab === "list" && (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 25 }}>
            <KPICard icon="suppliers" label="Total Suppliers" value={summary?.total ?? 0} color="#0055A5" bg="rgba(0,85,165,0.1)" />
            <KPICard icon="check" label="Active Partners" value={summary?.active ?? 0} color="#2E7D32" bg="rgba(46,125,50,0.1)" />
            <KPICard icon="inventory" label="Total Purchases" value={`EGP ${((summary?.totalValue || 0) / 1000).toFixed(1)}K`} color="#7B1FA2" bg="rgba(123,31,162,0.1)" />
            <KPICard icon="star" label="Avg. Rating" value={summary?.avgRating ?? 0} color="#F57C00" bg="rgba(245,124,0,0.1)" />
          </div>

          <div className="card shadow-sm">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="card-title">Manage Suppliers</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}><Icon name="plus" size={14} />Register New Supplier</button>
            </div>
            <div className="filter-bar" style={{ padding: 15 }}>
              <SearchBar value={search} onChange={setSearch} placeholder="Search by name, email, or category..." />
            </div>

            <div className="table-wrap">
              <table style={{ borderCollapse: "separate", borderSpacing: "0 8px" }}>
                <thead>
                  <tr style={{ background: "transparent" }}>
                    <th style={{ paddingLeft: 20 }}>Supplier Name</th>
                    <th>Category</th>
                    <th>Contact Info</th>
                    <th>Total Value</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right", paddingRight: 20 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(s => (
                    <tr key={s.id} className="table-row-hover" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <td style={{ padding: "15px 20px" }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>Joined: {s.lastOrder || 'New'}</div>
                      </td>
                      <td><span style={{ fontSize: 11, background: "rgba(0,169,206,0.1)", color: "#00A9CE", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{s.category}</span></td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{s.contact}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{s.email}</div>
                      </td>
                      <td style={{ fontWeight: 700, color: "#0055A5" }}>EGP {s.totalValue.toLocaleString()}</td>
                      <td><Badge status={s.status} /></td>
                      <td style={{ textAlign: "right", paddingRight: 20 }}>
                        <button className="btn btn-xs btn-secondary" onClick={() => handleViewProfile(s)}>
                          <Icon name="eye" size={12} /> View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && !loading && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>No suppliers found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={totalSuppliers} perPage={perPage} page={page} setPage={setPage} />
          </div>
        </>
      )}

      {/* ═══════════════ PURCHASE ORDERS TAB ═══════════════ */}
      {tab === "orders" && (
        <div className="card fade-in">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="card-title">Purchase Tracking</span>
            <button className="btn btn-success btn-sm" onClick={() => setShowPOModal(true)}><Icon name="plus" size={14} />Create Purchase Order</button>
          </div>

          <div className="table-wrap">
            <table style={{ borderCollapse: "separate", borderSpacing: "0 8px" }}>
              <thead>
                <tr style={{ background: "transparent" }}>
                  <th style={{ paddingLeft: 20 }}>Order Ref</th>
                  <th>Supplier</th>
                  <th>Items Count</th>
                  <th>Total Amount</th>
                  <th>Ordered On</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right", paddingRight: 20 }}>Update Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <td style={{ padding: "15px 20px" }}>
                      <div style={{ fontWeight: 800, color: "#0055A5", fontSize: 13 }}>#PO-{o.id.toString().padStart(4, '0')}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{o.supplier_name}</td>
                    <td>{o.items?.length || 0} items</td>
                    <td style={{ fontWeight: 700 }}>EGP {o.total_amount.toLocaleString()}</td>
                    <td style={{ fontSize: 12, color: "var(--text3)" }}>{new Date(o.created_at + 'Z').toLocaleDateString()}</td>
                    <td><Badge status={o.status} /></td>
                    <td style={{ textAlign: "right", paddingRight: 20 }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                        {o.status === 'Pending' && (
                          <>
                            <button className="btn btn-xs btn-secondary" onClick={() => openEditPO(o)}><Icon name="edit" size={12} /></button>
                            <button className="btn btn-xs btn-primary" onClick={() => handleUpdatePOStatus(o.id, 'Approved')}>Approve</button>
                          </>
                        )}
                        {o.status === 'Approved' && (
                          <>
                            <button className="btn btn-xs btn-secondary" onClick={() => openEditPO(o)}><Icon name="edit" size={12} /></button>
                            <button className="btn btn-xs btn-success" onClick={async () => { await handleUpdatePOStatus(o.id, 'Delivered'); fetchInventory(); }}>🚚 Delivered</button>
                          </>
                        )}
                        {!['Delivered', 'Cancelled'].includes(o.status) && (
                          <button className="btn btn-xs btn-danger" onClick={() => handleUpdatePOStatus(o.id, 'Cancelled')}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && !poLoading && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>No purchase orders recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════ ANALYTICS TAB ═══════════════ */}
      {tab === "analytics" && (
        <div className="fade-in">
          {analyticsLoading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Loading insights...</div> : analytics && (
            <>
              <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 25 }}>
                <div className="card shadow-sm" style={{ padding: 20, textAlign: "center", borderLeft: "5px solid #0055A5" }}>
                  <div style={{ color: "var(--text3)", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Total Purchase Vol.</div>
                  <div style={{ fontSize: 24, fontWeight: 800, margin: "10px 0", color: "#0055A5" }}>EGP {analytics.totalPurchaseValue.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>Across delivered orders</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 20, textAlign: "center", borderLeft: "5px solid #7B1FA2" }}>
                  <div style={{ color: "var(--text3)", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Top Strategic Supplier</div>
                  <div style={{ fontSize: 20, fontWeight: 800, margin: "10px 0", color: "#7B1FA2" }}>{analytics.topSupplier}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>By total purchase value</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 20, textAlign: "center", borderLeft: "5px solid #2E7D32" }}>
                  <div style={{ color: "var(--text3)", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Total Active Suppliers</div>
                  <div style={{ fontSize: 24, fontWeight: 800, margin: "10px 0", color: "#2E7D32" }}>{analytics.totalSuppliers}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>Registered in the system</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div className="card shadow-sm">
                  <div className="card-header"><span className="card-title">Spending by Supplier</span></div>
                  <div style={{ padding: 20 }}>
                    {analytics.purchasesPerSupplier.map((s: any) => {
                      const maxVal = Math.max(...analytics.purchasesPerSupplier.map((x: any) => x.value || 0), 1);
                      const width = ((s.value || 0) / maxVal) * 100;
                      return (
                        <div key={s.name} style={{ marginBottom: 15 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#0055A5" }}>EGP {s.value.toLocaleString()}</span>
                          </div>
                          <div style={{ height: 10, background: "var(--surface2)", borderRadius: 5, overflow: "hidden" }}>
                            <div style={{ width: `${width}%`, height: "100%", background: "linear-gradient(90deg, #0055A5, #00A9CE)", borderRadius: 5 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card shadow-sm">
                  <div className="card-header"><span className="card-title">Top Supplied Products</span></div>
                  <div style={{ padding: 20 }}>
                    {analytics.mostSuppliedItems.map((item: any) => (
                      <div key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#2E7D32" }}>{item.total_qty} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════ MODALS ═══════════════ */}

      {/* Supplier Profile Modal */}
      <Modal open={showProfile} onClose={() => setShowProfile(false)} title={`Supplier Dossier: ${selectedSupplier?.name}`} width={800}
        footer={<button className="btn btn-secondary" onClick={() => setShowProfile(false)}>Close Dossier</button>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 25 }}>
          <div style={{ borderRight: "1px solid var(--border)", paddingRight: 20 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 80, height: 80, background: "rgba(0,85,165,0.1)", color: "#0055A5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px", fontSize: 32, fontWeight: 800 }}>
                {selectedSupplier?.name.charAt(0)}
              </div>
              <h3 style={{ margin: 0 }}>{selectedSupplier?.name}</h3>
              <Badge status={selectedSupplier?.status} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div><label style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase" }}>Contact Person</label><div style={{ fontWeight: 600 }}>{selectedSupplier?.contact}</div></div>
              <div><label style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase" }}>Email Address</label><div style={{ fontWeight: 600 }}>{selectedSupplier?.email}</div></div>
              <div><label style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase" }}>Category</label><div style={{ fontWeight: 600 }}>{selectedSupplier?.category}</div></div>
              <div style={{ padding: "15px 0", borderTop: "1px solid var(--border)", marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12 }}>Total Orders</span>
                  <span style={{ fontWeight: 700 }}>{supplierPurchases.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12 }}>Total Spent</span>
                  <span style={{ fontWeight: 700, color: "#0055A5" }}>EGP {supplierPurchases.filter(p => p.status === 'Delivered').reduce((sum, p) => sum + p.total_amount, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 15px" }}><Icon name="inventory" size={16} /> Purchase History</h4>
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                <table style={{ fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--surface2)" }}>
                    <tr><th>Order #</th><th>Date</th><th>Amount</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {supplierPurchases.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>#PO-{p.id}</td>
                        <td>{new Date(p.created_at + 'Z').toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>EGP {p.total_amount.toLocaleString()}</td>
                        <td><Badge status={p.status} /></td>
                      </tr>
                    ))}
                    {supplierPurchases.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: 20 }}>No purchase history.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 15px" }}><Icon name="checklist" size={16} /> Inventory Items Supplied</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {supplierItems.map(i => (
                  <div key={i.id} style={{ background: "rgba(0,169,206,0.05)", border: "1px solid rgba(0,169,206,0.1)", borderRadius: 12, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "#00A9CE" }}>
                    {i.name} ({i.sku})
                  </div>
                ))}
                {supplierItems.length === 0 && <div style={{ color: "var(--text3)", fontSize: 12 }}>No inventory items linked to this supplier.</div>}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Create / Edit Purchase Order Modal */}
      <Modal open={showPOModal} onClose={() => { setShowPOModal(false); setEditingPO(null); setPoItems([{ inventory_item_id: "", quantity: 1, price: 0 }]); }} title={editingPO ? "Edit Purchase Order" : "New Procurement Order"} width={700}
        footer={<><button className="btn btn-secondary" onClick={() => { setShowPOModal(false); setEditingPO(null); }}>Discard</button><button className="btn btn-success" onClick={handleCreatePO}>{editingPO ? "Save Changes" : "Submit Order"}</button></>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Vendor / Supplier *</label>
              <select className="form-input" value={poSupplierId} onChange={e => setPoSupplierId(e.target.value)} disabled={!!editingPO}>
                <option value="">— Choose a Strategic Partner —</option>
                {suppliers.filter(s => s.status === 'Active').map(s => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Authorized By</label>
              <input className="form-input" placeholder="Name of officer" value={poAuthorizedBy} onChange={e => setPoAuthorizedBy(e.target.value)} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Required Inventory Items</label>
              <button className="btn btn-xs" onClick={() => setPoItems([...poItems, { inventory_item_id: "", quantity: 1, price: 0 }])} style={{ color: "#0055A5" }}>+ Add Another Item</button>
            </div>

            <div style={{ maxHeight: 250, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
              {poItems.map((item, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 100px 140px 40px", gap: 10, marginBottom: 10 }}>
                  <select className="form-input" value={item.inventory_item_id}
                    onChange={e => setPoItems(poItems.map((p, i) => i === idx ? { ...p, inventory_item_id: e.target.value, price: inventoryItems.find(inv => inv.id.toString() === e.target.value)?.unitPrice || 0 } : p))}>
                    <option value="">— Select Material —</option>
                    {inventoryItems.map(inv => <option key={inv.id} value={inv.id}>{inv.name} ({inv.sku})</option>)}
                  </select>
                  <input className="form-input" type="number" placeholder="Qty" value={item.quantity} onChange={e => setPoItems(poItems.map((p, i) => i === idx ? { ...p, quantity: parseInt(e.target.value) || 0 } : p))} />
                  <input className="form-input" type="number" placeholder="Price" value={item.price} onChange={e => setPoItems(poItems.map((p, i) => i === idx ? { ...p, price: parseFloat(e.target.value) || 0 } : p))} />
                  <button className="btn btn-xs btn-danger" onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))} disabled={poItems.length === 1}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 15, textAlign: "right", borderTop: "2px solid var(--border)", paddingTop: 10 }}>
              <span style={{ fontSize: 13, color: "var(--text3)", marginRight: 15 }}>Total Procurement Value:</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#0055A5" }}>EGP {poItems.reduce((acc, i) => acc + (i.quantity * i.price), 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Supplier Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Onboard New Supplier"
        footer={<><button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAddSupplier}>Register Supplier</button></>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          <div className="form-group"><label className="form-label">Corporate Name *</label><input ref={nameRef} className="form-input" placeholder="e.g., EVA Pharma, Office Depot" /></div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Primary Contact Phone</label><input ref={contactRef} className="form-input" placeholder="+20 1XX XXX XXXX" /></div>
            <div className="form-group"><label className="form-label">Official Email Address</label><input ref={emailRef} className="form-input" type="email" /></div>
          </div>
          <div className="form-group">
            <label className="form-label">Material Category</label>
            <select ref={catRef} className="form-input">
              {["General", "Laboratory", "Medical", "IT & Electronics", "Maintenance", "Office Supplies", "Safety"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
