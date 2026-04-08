"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { KPICard, SearchBar, Pagination, Badge, Modal } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { Icon } from "@/components/ui/Icon";
import { apiClient } from "@/services/apiClient";

const UNITS = ["pcs","kg","liter","box","roll","set","meter","pack"];
const STATUS_OPTIONS = ["Active","Inactive","Discontinued"];

export default function Inventory() {
  const toast = useToast();
  const [tab, setTab] = useState<"stock"|"log"|"analytics">("stock");

  // Stock tab state
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const perPage = 12;

  // Modals
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [newCatName, setNewCatName] = useState("");

  // Stock In refs
  const nameRef     = useRef<HTMLInputElement>(null);
  const catRef      = useRef<HTMLSelectElement>(null);
  const qtyRef      = useRef<HTMLInputElement>(null);
  const minStockRef = useRef<HTMLInputElement>(null);
  const unitRef     = useRef<HTMLSelectElement>(null);
  const priceRef    = useRef<HTMLInputElement>(null);
  const supplierRef = useRef<HTMLSelectElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);

  // Stock Out state
  const [soItem, setSoItem]       = useState("");
  const [soQty, setSoQty]         = useState("");
  const [soRecipient, setSoRecipient] = useState("");
  const [soDept, setSoDept]       = useState("");
  const [soPurpose, setSoPurpose] = useState("");
  const [soNotes, setSoNotes]     = useState("");

  // Edit refs
  const editNameRef  = useRef<HTMLInputElement>(null);
  const editCatRef   = useRef<HTMLSelectElement>(null);
  const editQtyRef   = useRef<HTMLInputElement>(null);
  const editMinRef   = useRef<HTMLInputElement>(null);
  const editUnitRef  = useRef<HTMLSelectElement>(null);
  const editPriceRef = useRef<HTMLInputElement>(null);
  const editSupRef   = useRef<HTMLInputElement>(null);
  const editLocRef   = useRef<HTMLInputElement>(null);
  const editStatusRef = useRef<HTMLSelectElement>(null);

  // Log tab state
  const [logData, setLogData] = useState<any[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logFilter, setLogFilter] = useState("All");
  const [logLoading, setLogLoading] = useState(false);

  // Analytics tab state
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Fetches ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, sum] = await Promise.all([
        apiClient.get<any>(`/inventory?search=${search}&category=${catFilter}&page=${page}&limit=${perPage}`),
        apiClient.get<any>('/inventory/summary'),
      ]);
      setData(res.data); setTotal(res.total); setSummary(sum);
    } catch { toast("Failed to load inventory","error"); }
    finally { setLoading(false); }
  }, [search, catFilter, page]);

  const fetchCategories = async () => {
    try {
      const cats = await apiClient.get<any[]>('/inventory/categories');
      setCategories(cats);
    } catch {}
  };

  const fetchLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const r = await apiClient.get<any>(`/inventory/log?page=${logPage}&limit=30&action=${logFilter}`);
      setLogData(r.data); setLogTotal(r.total);
    } catch { toast("Failed to load log","error"); }
    finally { setLogLoading(false); }
  }, [logPage, logFilter]);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const r = await apiClient.get<any>('/inventory/analytics');
      setAnalytics(r);
    } catch { toast("Failed to load analytics","error"); }
    finally { setAnalyticsLoading(false); }
  };

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => {
    apiClient.get<any[]>('/inventory/suppliers-list').then(setSuppliers).catch(() => {});
  }, []);
  useEffect(() => { if (tab === "log") fetchLog(); }, [tab, fetchLog]);
  useEffect(() => { if (tab === "analytics") fetchAnalytics(); }, [tab]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAddStock = async () => {
    const name = nameRef.current?.value?.trim();
    const qty = qtyRef.current?.value;
    const price = priceRef.current?.value;
    const location = locationRef.current?.value?.trim();
    if (!name || name.length < 2) { toast("Item name must be at least 2 characters","error"); return; }
    if (!qty || parseInt(qty) < 0) { toast("Valid quantity is required","error"); return; }
    if (!price || parseFloat(price) < 0) { toast("Valid unit price is required","error"); return; }
    if (!location) { toast("Storage location is required","error"); return; }
    try {
      await apiClient.post('/inventory', {
        name, category: catRef.current?.value,
        quantity: parseInt(qty),
        minStock: parseInt(minStockRef.current?.value || '10'),
        unit: unitRef.current?.value || 'pcs',
        unitPrice: parseFloat(price),
        supplier: supplierRef.current?.value || '',
        location,
      });
      toast("Stock added successfully","success");
      setShowStockInModal(false);
      fetchData();
    } catch (e: any) { toast(e.message || "Failed to add stock","error"); }
  };

  const handleStockOut = async () => {
    if (!soItem) { toast("Select an item","error"); return; }
    if (!soQty || parseInt(soQty) <= 0) { toast("Quantity must be greater than 0","error"); return; }
    if (!soRecipient.trim()) { toast("Recipient is required","error"); return; }
    const item = data.find(i => String(i.id) === soItem);
    if (item && parseInt(soQty) > item.quantity) { toast(`Only ${item.quantity} units available`,"error"); return; }
    try {
      await apiClient.post('/inventory/stock-out', {
        itemId: parseInt(soItem), quantity: parseInt(soQty),
        recipient: soRecipient.trim(), department: soDept.trim(),
        purpose: soPurpose.trim(), notes: soNotes.trim(),
      });
      toast("Stock out recorded","success");
      setShowStockOutModal(false);
      setSoItem(""); setSoQty(""); setSoRecipient(""); setSoDept(""); setSoPurpose(""); setSoNotes("");
      fetchData();
    } catch (e: any) { toast(e.message || "Failed to process stock out","error"); }
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setShowEditModal(true);
    setTimeout(() => {
      if (editNameRef.current)   editNameRef.current.value   = item.name || '';
      if (editCatRef.current)    editCatRef.current.value    = item.category || '';
      if (editQtyRef.current)    editQtyRef.current.value    = item.quantity;
      if (editMinRef.current)    editMinRef.current.value    = item.minStock;
      if (editUnitRef.current)   editUnitRef.current.value   = item.unit || 'pcs';
      if (editPriceRef.current)  editPriceRef.current.value  = item.unitPrice;
      if (editSupRef.current)    editSupRef.current.value    = item.supplier || '';
      if (editLocRef.current)    editLocRef.current.value    = item.location || '';
      if (editStatusRef.current) editStatusRef.current.value = item.status || 'Active';
    }, 50);
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    const name = editNameRef.current?.value?.trim();
    if (!name || name.length < 2) { toast("Item name must be at least 2 characters","error"); return; }
    const qty = parseInt(editQtyRef.current?.value || '0');
    const price = parseFloat(editPriceRef.current?.value || '0');
    if (isNaN(qty) || qty < 0) { toast("Quantity must be non-negative","error"); return; }
    if (isNaN(price) || price < 0) { toast("Price must be non-negative","error"); return; }
    try {
      await apiClient.put(`/inventory/${editItem.id}`, {
        name, category: editCatRef.current?.value, quantity: qty,
        min_stock: parseInt(editMinRef.current?.value || '10'),
        unit: editUnitRef.current?.value || 'pcs', unit_price: price,
        supplier: editSupRef.current?.value || '', location: editLocRef.current?.value || '',
        status: editStatusRef.current?.value || 'Active',
      });
      toast("Item updated successfully","success");
      setShowEditModal(false); setEditItem(null); fetchData();
    } catch (e: any) { toast(e.message || "Failed to update","error"); }
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await apiClient.delete(`/inventory/${item.id}`);
      toast(`${item.name} deleted`,"success"); fetchData();
    } catch { toast("Failed to delete","error"); }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) { toast("Category name required","error"); return; }
    try {
      await apiClient.post('/inventory/categories', { name: newCatName.trim() });
      toast("Category added","success");
      setNewCatName("");
      fetchCategories();
    } catch (e: any) { toast(e.message || "Failed","error"); }
  };

  const handleDeleteCategory = async (cat: any) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await apiClient.delete(`/inventory/categories/${cat.id}`);
      toast("Category deleted","success"); fetchCategories();
    } catch (e: any) { toast(e.message || "Failed","error"); }
  };

  const handleExport = () => {
    const csv = [
      ['SKU','Item Name','Category','Quantity','Min Stock','Unit','Unit Price','Location','Status'],
      ...data.map(i => [i.sku,i.name,i.category,i.quantity,i.minStock,i.unit,i.unitPrice,i.location,i.status||'Active'])
    ].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
    link.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast('Inventory exported!','success');
  };

  const lowStockItems = data.filter(i => i.quantity <= i.minStock);
  const allCategoryNames = ["All", ...categories.map(c => c.name)];

  // ── Action icon for log ──────────────────────────────────────────────────────
  const actionIcon = (a: string) => {
    switch (a) {
      case 'stock_in':       return '📥';
      case 'stock_out':      return '📤';
      case 'edit':           return '✏️';
      case 'delete':         return '🗑️';
      case 'status_change':  return '🔄';
      case 'category_add':   return '📂';
      case 'category_delete':return '🗂️';
      default:               return '📋';
    }
  };
  const actionColor = (a: string) => {
    switch (a) {
      case 'stock_in':      return '#2E7D32';
      case 'stock_out':     return '#C62828';
      case 'delete':        return '#C62828';
      case 'edit':          return '#F57C00';
      case 'status_change': return '#7B1FA2';
      default:              return '#0055A5';
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fade-in">
      {/* Tabs */}
      <div style={{ display:"flex",gap:0,marginBottom:20,borderBottom:"2px solid var(--border)" }}>
        {([["stock","📦 Stock"],["log","📋 Activity Log"],["analytics","📊 Analytics"]] as [string,string][]).map(([key,label]) => (
          <button key={key} onClick={()=>setTab(key as any)} style={{
            padding:"10px 24px",fontWeight:600,fontSize:14,border:"none",cursor:"pointer",
            borderBottom: tab===key ? "3px solid #0055A5":"3px solid transparent",
            color: tab===key?"#0055A5":"var(--text2)",
            background:"transparent",marginBottom:-2,
          }}>{label}</button>
        ))}
      </div>

      {/* ═══════════════ STOCK TAB ═══════════════ */}
      {tab === "stock" && (
        <>
          {lowStockItems.length > 0 && (
            <div className="alert alert-warning" style={{ marginBottom:16 }}>
              <Icon name="alert" size={16} />
              <strong>{lowStockItems.length} items</strong> are below minimum stock level and need restocking!
            </div>
          )}
          <div className="kpi-grid" style={{ gridTemplateColumns:"repeat(4,1fr)" }}>
            <KPICard icon="inventory" label="Total Items"  value={summary?.totalItems ?? '—'}                           color="#0055A5" bg="rgba(0,85,165,0.1)" />
            <KPICard icon="alert"     label="Low Stock"    value={summary?.lowStock ?? '—'}                             color="#C62828" bg="rgba(198,40,40,0.1)" />
            <KPICard icon="canteen"   label="Total Value"  value={`EGP ${((summary?.totalValue||0)/1000).toFixed(0)}K`} color="#2E7D32" bg="rgba(46,125,50,0.1)" />
            <KPICard icon="suppliers" label="Categories"   value={summary?.categories ?? '—'}                           color="#7B1FA2" bg="rgba(123,31,162,0.1)" />
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Inventory Stock ({total} items)</span>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-success btn-sm" onClick={() => setShowStockInModal(true)}><Icon name="plus" size={14} />Stock In</button>
                <button className="btn btn-danger btn-sm"  onClick={() => setShowStockOutModal(true)}><Icon name="minus" size={14} />Stock Out</button>
                <button className="btn btn-sm" onClick={()=>setShowCategoryModal(true)} style={{ background:"rgba(123,31,162,0.1)",color:"#7B1FA2",border:"1px solid rgba(123,31,162,0.2)" }}>📂 Categories</button>
                <button className="btn btn-secondary btn-sm" onClick={handleExport}><Icon name="download" size={14} />Export</button>
              </div>
            </div>
            <div className="filter-bar">
              <SearchBar value={search} onChange={(v)=>{setSearch(v);setPage(1);}} placeholder="Search by name or SKU..." />
              {allCategoryNames.map(c => (
                <button key={c} className={`btn btn-xs ${catFilter===c?"btn-primary":"btn-secondary"}`} onClick={()=>{setCatFilter(c);setPage(1);}}>
                  {c}
                </button>
              ))}
            </div>
            {loading ? <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Loading...</div> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>SKU</th><th>Item Name</th><th>Category</th><th>Quantity</th><th>Min Stock</th><th>Unit Price</th><th>Location</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {data.map(item => {
                      const isLow = item.quantity <= item.minStock;
                      return (
                        <tr key={item.id}>
                          <td style={{ fontFamily:"monospace", fontSize:12, color:"var(--text3)" }}>{item.sku}</td>
                          <td style={{ fontWeight:500 }}>{item.name}</td>
                          <td><span style={{ background:"var(--accent2)", color:"var(--primary)", padding:"2px 8px", borderRadius:12, fontSize:11 }}>{item.category}</span></td>
                          <td><span style={{ fontWeight:600, color: isLow?"var(--danger)":"var(--text)" }}>{item.quantity} {item.unit} {isLow&&"⚠️"}</span></td>
                          <td style={{ color:"var(--text3)" }}>{item.minStock}</td>
                          <td>EGP {item.unitPrice}</td>
                          <td style={{ fontSize:12, color:"var(--text3)" }}>{item.location}</td>
                          <td><Badge status={item.status==='Discontinued'?'Rejected':item.status==='Inactive'?'Late':item.quantity===0?'Inactive':isLow?'Late':'Active'} /></td>
                          <td>
                            <div style={{ display:"flex", gap:4 }}>
                              <button className="btn btn-xs btn-secondary" onClick={() => openEdit(item)}><Icon name="edit" size={12} /></button>
                              <button className="btn btn-xs btn-danger" onClick={() => handleDelete(item)}><Icon name="trash" size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination total={total} perPage={perPage} page={page} setPage={setPage} />
          </div>

          {/* Stock In Modal */}
          <Modal open={showStockInModal} onClose={() => setShowStockInModal(false)} title="Stock In — Add New Item"
            footer={<>
              <button className="btn btn-secondary" onClick={() => setShowStockInModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddStock}>Confirm Stock In</button>
            </>}
          >
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div className="form-group"><label className="form-label">Item Name *</label><input ref={nameRef} className="form-input" placeholder="Enter item name" /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Category *</label>
                  <select ref={catRef} className="form-input">{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>
                </div>
                <div className="form-group"><label className="form-label">Unit</label>
                  <select ref={unitRef} className="form-input">{UNITS.map(u=><option key={u}>{u}</option>)}</select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Quantity *</label><input ref={qtyRef} className="form-input" type="number" placeholder="0" min="0" /></div>
                <div className="form-group"><label className="form-label">Min Stock Alert</label><input ref={minStockRef} className="form-input" type="number" defaultValue="10" min="0" /></div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Unit Price (EGP) *</label><input ref={priceRef} className="form-input" type="number" step="0.01" placeholder="0.00" /></div>
                <div className="form-group"><label className="form-label">Supplier</label>
                  <select ref={supplierRef} className="form-input">
                    <option value="">— No supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Storage Location *</label><input ref={locationRef} className="form-input" placeholder="e.g., Warehouse-A, Shelf-3" /></div>
            </div>
          </Modal>

          {/* Stock Out Modal — Enhanced */}
          <Modal open={showStockOutModal} onClose={() => setShowStockOutModal(false)} title="📤 Stock Out — Remove Items"
            footer={<>
              <button className="btn btn-secondary" onClick={() => setShowStockOutModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleStockOut}>Confirm Stock Out</button>
            </>}
          >
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div className="form-group"><label className="form-label">Select Item *</label>
                <select className="form-input" value={soItem} onChange={e=>setSoItem(e.target.value)}>
                  <option value="">— Select item —</option>
                  {data.filter(i=>i.quantity>0).map(i => (
                    <option key={i.id} value={i.id}>{i.name} — Available: {i.quantity} {i.unit}</option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Quantity *</label>
                  <input className="form-input" type="number" min="1" placeholder="Enter quantity" value={soQty} onChange={e=>setSoQty(e.target.value)} />
                </div>
                <div className="form-group"><label className="form-label">Recipient Name *</label>
                  <input className="form-input" placeholder="Who's receiving this?" value={soRecipient} onChange={e=>setSoRecipient(e.target.value)} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Department</label>
                  <input className="form-input" placeholder="e.g., IT, Maintenance" value={soDept} onChange={e=>setSoDept(e.target.value)} />
                </div>
                <div className="form-group"><label className="form-label">Purpose / Reason</label>
                  <input className="form-input" placeholder="e.g., Lab supplies, Repair" value={soPurpose} onChange={e=>setSoPurpose(e.target.value)} />
                </div>
              </div>
              <div className="form-group"><label className="form-label">Notes (Optional)</label>
                <textarea className="form-input" rows={2} placeholder="Additional notes..." value={soNotes} onChange={e=>setSoNotes(e.target.value)} style={{ resize:"vertical" }} />
              </div>
              <div style={{ padding:12, background:"rgba(198,40,40,0.08)", borderRadius:8, fontSize:13, color:"var(--danger)" }}>
                ⚠️ Stock out is permanent and will be recorded with full details in the Activity Log.
              </div>
            </div>
          </Modal>

          {/* Edit Modal */}
          <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditItem(null); }} title={`Edit Item — ${editItem?.name || ''}`}
            footer={<>
              <button className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditItem(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
            </>}
          >
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div className="form-group"><label className="form-label">Item Name *</label><input ref={editNameRef} className="form-input" /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Category</label>
                  <select ref={editCatRef} className="form-input">{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>
                </div>
                <div className="form-group"><label className="form-label">Unit</label>
                  <select ref={editUnitRef} className="form-input">{UNITS.map(u=><option key={u}>{u}</option>)}</select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Quantity</label><input ref={editQtyRef} className="form-input" type="number" min="0" /></div>
                <div className="form-group"><label className="form-label">Min Stock</label><input ref={editMinRef} className="form-input" type="number" min="0" /></div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Unit Price (EGP)</label><input ref={editPriceRef} className="form-input" type="number" step="0.01" /></div>
                <div className="form-group"><label className="form-label">Status</label>
                  <select ref={editStatusRef} className="form-input">
                    {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Supplier</label><input ref={editSupRef} className="form-input" placeholder="Supplier name" /></div>
                <div className="form-group"><label className="form-label">Storage Location</label><input ref={editLocRef} className="form-input" /></div>
              </div>
            </div>
          </Modal>

          {/* Category Manager Modal */}
          <Modal open={showCategoryModal} onClose={()=>setShowCategoryModal(false)} title="📂 Manage Categories"
            footer={<button className="btn btn-primary" onClick={()=>setShowCategoryModal(false)}>Done</button>}
          >
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <div style={{ display:"flex",gap:8 }}>
                <input className="form-input" style={{ flex:1 }} value={newCatName} onChange={e=>setNewCatName(e.target.value)}
                  placeholder="New category name..." onKeyDown={e=>{ if(e.key==='Enter') handleAddCategory(); }} />
                <button className="btn btn-primary btn-sm" onClick={handleAddCategory}>+ Add</button>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {categories.map(cat=>(
                  <div key={cat.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",
                    background:"var(--surface2)",borderRadius:8,fontSize:14 }}>
                    <span style={{ fontWeight:500 }}>{cat.name}</span>
                    <button onClick={()=>handleDeleteCategory(cat)}
                      style={{ background:"rgba(198,40,40,0.1)",color:"#C62828",border:"1px solid rgba(198,40,40,0.2)",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12 }}>
                      ✕
                    </button>
                  </div>
                ))}
                {categories.length === 0 && <div style={{ padding:16,textAlign:"center",color:"var(--text3)",fontSize:13 }}>No categories yet</div>}
              </div>
            </div>
          </Modal>
        </>
      )}

      {/* ═══════════════ ACTIVITY LOG TAB ═══════════════ */}
      {tab === "log" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 Activity Log ({logTotal} entries)</span>
          </div>
          <div className="filter-bar">
            {["All","stock_in","stock_out","edit","delete","status_change","category_add"].map(a=>(
              <button key={a} className={`btn btn-xs ${logFilter===a?"btn-primary":"btn-secondary"}`} onClick={()=>{setLogFilter(a);setLogPage(1);}}>
                {a==='All'?'All':a.replace(/_/g,' ')}
              </button>
            ))}
          </div>
          {logLoading ? <div style={{ padding:40,textAlign:'center',color:'var(--text3)' }}>Loading...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Time</th><th>Action</th><th>Item</th><th>Details</th><th>By</th></tr></thead>
                <tbody>
                  {logData.map(l=>(
                    <tr key={l.id}>
                      <td style={{ fontSize:12,color:"var(--text3)",whiteSpace:"nowrap" }}>{new Date(l.created_at+'Z').toLocaleString()}</td>
                      <td>
                        <span style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:12,fontSize:12,fontWeight:600,
                          background:`${actionColor(l.action)}15`,color:actionColor(l.action) }}>
                          {actionIcon(l.action)} {l.action.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td style={{ fontWeight:500 }}>{l.item_name || '—'} <span style={{ color:"var(--text3)",fontSize:11 }}>{l.item_sku||''}</span></td>
                      <td style={{ fontSize:13,color:"var(--text2)",maxWidth:300 }}>{l.details || '—'}</td>
                      <td style={{ fontSize:12,color:"var(--text3)" }}>{l.performed_by || 'System'}</td>
                    </tr>
                  ))}
                  {logData.length===0 && <tr><td colSpan={5} style={{ textAlign:"center",padding:40,color:"var(--text3)" }}>No activity logs yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <Pagination total={logTotal} perPage={30} page={logPage} setPage={setLogPage} />
        </div>
      )}

      {/* ═══════════════ ANALYTICS TAB ═══════════════ */}
      {tab === "analytics" && (
        <div>
          {analyticsLoading ? <div style={{ padding:40,textAlign:'center',color:'var(--text3)' }}>Loading analytics...</div> : analytics && (
            <>
              {/* Quick Stats */}
              <div className="kpi-grid" style={{ gridTemplateColumns:"repeat(4,1fr)",marginBottom:20 }}>
                <KPICard icon="inventory" label="Total Items" value={summary?.totalItems ?? '—'} color="#0055A5" bg="rgba(0,85,165,0.1)" />
                <KPICard icon="alert" label="Low Stock" value={summary?.lowStock ?? '—'} color="#C62828" bg="rgba(198,40,40,0.1)" />
                <KPICard icon="canteen" label="Total Value" value={`EGP ${((summary?.totalValue||0)/1000).toFixed(0)}K`} color="#2E7D32" bg="rgba(46,125,50,0.1)" />
                <KPICard icon="minus" label="Total Stock Outs" value={summary?.totalStockOuts ?? '—'} color="#F57C00" bg="rgba(245,124,0,0.1)" />
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20 }}>
                {/* Value by Category */}
                <div className="card">
                  <div className="card-header"><span className="card-title">📊 Stock Value by Category</span></div>
                  <div style={{ padding:"0 0 16px" }}>
                    {analytics.valueByCategory?.map((c:any) => {
                      const maxVal = Math.max(...analytics.valueByCategory.map((x:any)=>x.totalValue||0), 1);
                      return (
                        <div key={c.category} style={{ display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid var(--border)" }}>
                          <span style={{ width:100,fontSize:13,fontWeight:500 }}>{c.category}</span>
                          <div style={{ flex:1,height:20,background:"var(--surface2)",borderRadius:10,overflow:"hidden" }}>
                            <div style={{ width:`${((c.totalValue||0)/maxVal)*100}%`,height:"100%",background:"linear-gradient(90deg,#0055A5,#00A9CE)",borderRadius:10,transition:"width 0.5s" }} />
                          </div>
                          <span style={{ fontSize:12,fontWeight:600,color:"#0055A5",width:80,textAlign:"right" }}>EGP {Math.round(c.totalValue||0).toLocaleString()}</span>
                          <span style={{ fontSize:11,color:"var(--text3)",width:50,textAlign:"right" }}>{c.itemCount} items</span>
                        </div>
                      );
                    })}
                    {(!analytics.valueByCategory || analytics.valueByCategory.length===0) && <div style={{ padding:20,textAlign:"center",color:"var(--text3)" }}>No data</div>}
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="card">
                  <div className="card-header"><span className="card-title">🔄 Status Breakdown</span></div>
                  <div style={{ padding:"0 0 16px",display:"flex",flexDirection:"column",gap:12 }}>
                    {analytics.statusBreakdown?.map((s:any)=>(
                      <div key={s.status} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",
                        background:s.status==='Active'?"rgba(46,125,50,0.08)":s.status==='Inactive'?"rgba(245,124,0,0.08)":"rgba(198,40,40,0.08)",
                        borderRadius:8 }}>
                        <span style={{ fontWeight:600,color:s.status==='Active'?"#2E7D32":s.status==='Inactive'?"#F57C00":"#C62828" }}>
                          {s.status==='Active'?'✅':'⚠️'} {s.status}
                        </span>
                        <span style={{ fontSize:24,fontWeight:700,color:"var(--text)" }}>{s.count}</span>
                      </div>
                    ))}
                    {(!analytics.statusBreakdown || analytics.statusBreakdown.length===0) && <div style={{ padding:20,textAlign:"center",color:"var(--text3)" }}>No data</div>}
                  </div>
                </div>
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20 }}>
                {/* Top Items by Value */}
                <div className="card">
                  <div className="card-header"><span className="card-title">💎 Top Items by Value</span></div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total Value</th></tr></thead>
                      <tbody>
                        {analytics.topByValue?.map((t:any,i:number)=>(
                          <tr key={i}>
                            <td style={{ fontWeight:500 }}>{t.name} <span style={{ color:"var(--text3)",fontSize:11 }}>{t.sku}</span></td>
                            <td>{t.quantity}</td>
                            <td>EGP {t.unit_price}</td>
                            <td style={{ fontWeight:600,color:"#0055A5" }}>EGP {Math.round(t.value).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Stock Out */}
                <div className="card">
                  <div className="card-header"><span className="card-title">📤 Most Removed Items</span></div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Item</th><th>Total Out</th><th>Transactions</th></tr></thead>
                      <tbody>
                        {analytics.topStockOut?.map((t:any,i:number)=>(
                          <tr key={i}>
                            <td style={{ fontWeight:500 }}>{t.item_name}</td>
                            <td style={{ fontWeight:600,color:"#C62828" }}>{t.totalOut}</td>
                            <td>{t.outCount}</td>
                          </tr>
                        ))}
                        {(!analytics.topStockOut || analytics.topStockOut.length===0) && <tr><td colSpan={3} style={{ textAlign:"center",color:"var(--text3)" }}>No stock outs yet</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20 }}>
                {/* Stock Out by Department */}
                <div className="card">
                  <div className="card-header"><span className="card-title">🏢 Stock Out by Department</span></div>
                  <div style={{ padding:"0 0 16px" }}>
                    {analytics.outByDepartment?.map((d:any)=>(
                      <div key={d.department} style={{ display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--border)" }}>
                        <span style={{ fontWeight:500 }}>{d.department}</span>
                        <div style={{ display:"flex",gap:16 }}>
                          <span style={{ fontSize:13,color:"#C62828",fontWeight:600 }}>{d.totalOut} units</span>
                          <span style={{ fontSize:12,color:"var(--text3)" }}>{d.transactions} txns</span>
                        </div>
                      </div>
                    ))}
                    {(!analytics.outByDepartment || analytics.outByDepartment.length===0) && <div style={{ padding:20,textAlign:"center",color:"var(--text3)" }}>No department data yet</div>}
                  </div>
                </div>

                {/* Low Stock Items */}
                <div className="card">
                  <div className="card-header"><span className="card-title">⚠️ Low Stock Alert</span></div>
                  <div className="table-wrap" style={{ maxHeight:300,overflowY:"auto" }}>
                    <table>
                      <thead><tr><th>Item</th><th>Category</th><th>Current</th><th>Min</th></tr></thead>
                      <tbody>
                        {analytics.lowStockItems?.map((l:any,i:number)=>(
                          <tr key={i}>
                            <td style={{ fontWeight:500 }}>{l.name}</td>
                            <td style={{ fontSize:12 }}>{l.category}</td>
                            <td style={{ fontWeight:600,color:"#C62828" }}>{l.quantity} {l.unit}</td>
                            <td style={{ color:"var(--text3)" }}>{l.min_stock}</td>
                          </tr>
                        ))}
                        {(!analytics.lowStockItems || analytics.lowStockItems.length===0) && <tr><td colSpan={4} style={{ textAlign:"center",color:"var(--text3)" }}>No low stock items 🎉</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Monthly Movement */}
              {analytics.monthlyMovement && analytics.monthlyMovement.length > 0 && (
                <div className="card">
                  <div className="card-header"><span className="card-title">📈 Monthly Stock Out Movement</span></div>
                  <div style={{ padding:"0 0 16px" }}>
                    <div style={{ display:"flex",gap:8,alignItems:"flex-end",height:200,padding:"20px 0" }}>
                      {analytics.monthlyMovement.map((m:any)=>{
                        const maxOut = Math.max(...analytics.monthlyMovement.map((x:any)=>x.totalOut||0),1);
                        const h = Math.max(((m.totalOut||0)/maxOut)*160,4);
                        return (
                          <div key={m.month} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                            <span style={{ fontSize:11,fontWeight:600,color:"#C62828" }}>{m.totalOut||0}</span>
                            <div style={{ width:"100%",maxWidth:40,height:h,background:"linear-gradient(180deg,#C62828,#F57C00)",borderRadius:"4px 4px 0 0",transition:"height 0.5s" }} />
                            <span style={{ fontSize:10,color:"var(--text3)" }}>{m.month.split('-')[1]}/{m.month.split('-')[0].slice(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
