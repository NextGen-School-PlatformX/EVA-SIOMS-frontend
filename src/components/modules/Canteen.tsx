"use client";

import { useState, useEffect, useRef } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { KPICard, SearchBar, Badge, Tabs, Modal } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { Icon } from "@/components/ui/Icon";
import { apiClient } from "@/services/apiClient";
import type { CartItem, CanteenProduct } from "@/types";

const salesData = [
  { time:"8AM", revenue:320 },{ time:"9AM", revenue:580 },{ time:"10AM", revenue:240 },
  { time:"11AM", revenue:680 },{ time:"12PM", revenue:920 },{ time:"1PM", revenue:1100 },
  { time:"2PM", revenue:780 },{ time:"3PM", revenue:340 },
];
const CATEGORY_EMOJI: Record<string,string> = { "Drinks":"🥤","Hot Food":"🥪","Cold Food":"🥗","Snacks":"🍿","Dairy":"🥛","Bakery":"🧁" };
const TABS = [{ id:"pos", label:"Point of Sale" },{ id:"dashboard", label:"Dashboard" },{ id:"products", label:"Products" }];

export default function Canteen() {
  const toast = useToast();
  const [tab, setTab] = useState("pos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<CanteenProduct[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState<CanteenProduct | null>(null);

  const prodNameRef  = useRef<HTMLInputElement>(null);
  const prodPriceRef = useRef<HTMLInputElement>(null);
  const prodStockRef = useRef<HTMLInputElement>(null);
  const prodCatRef   = useRef<HTMLSelectElement>(null);

  const fetchProducts = async () => {
    try {
      const [prods, sum] = await Promise.all([
        apiClient.get<CanteenProduct[]>('/canteen/products'),
        apiClient.get<any>('/canteen/products/summary'),
      ]);
      setProducts(prods); setSummary(sum);
    } catch { toast("Failed to load products","error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, []);

  const addToCart = (product: CanteenProduct) => {
    if (product.stock <= 0) { toast("Out of stock!","error"); return; }
    setCart(c => {
      const existing = c.find(i => i.id === product.id);
      if (existing) return c.map(i => i.id===product.id ? { ...i, qty:i.qty+1 } : i);
      return [...c, { ...product, qty:1 }];
    });
  };

  const updateQty = (id: number, delta: number) =>
    setCart(c => c.map(i => i.id===id ? { ...i, qty: Math.max(0,i.qty+delta) } : i).filter(i => i.qty>0));

  const total = cart.reduce((s,i) => s+i.price*i.qty, 0);
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const openProductModal = (product?: CanteenProduct) => {
    setEditProduct(product || null);
    setShowProductModal(true);
    setTimeout(() => {
      if (prodNameRef.current)  prodNameRef.current.value  = product?.name  || '';
      if (prodPriceRef.current) prodPriceRef.current.value = product ? String(product.price) : '';
      if (prodStockRef.current) prodStockRef.current.value = product ? String(product.stock) : '';
      if (prodCatRef.current)   prodCatRef.current.value   = product?.category || 'Drinks';
    }, 50);
  };

  const handleSaveProduct = async () => {
    const name  = prodNameRef.current?.value?.trim();
    const price = parseFloat(prodPriceRef.current?.value || '0');
    const stock = parseInt(prodStockRef.current?.value || '0');
    const category = prodCatRef.current?.value;
    if (!name || name.length < 2) { toast("Product name is required","error"); return; }
    if (!price || price <= 0)     { toast("Price must be greater than 0","error"); return; }
    if (stock < 0)                { toast("Stock cannot be negative","error"); return; }
    if (!category)                { toast("Category is required","error"); return; }
    try {
      if (editProduct) {
        await apiClient.put(`/canteen/products/${editProduct.id}`, { name, price, stock, category });
        toast("Product updated","success");
      } else {
        await apiClient.post('/canteen/products', { name, price, stock, category });
        toast("Product added","success");
      }
      setShowProductModal(false); setEditProduct(null); fetchProducts();
    } catch (e: any) { toast(e.message || "Failed to save product","error"); }
  };

  const handleDeleteProduct = async (p: CanteenProduct) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await apiClient.delete(`/canteen/products/${p.id}`);
      toast(`${p.name} deleted`,"success"); fetchProducts();
    } catch { toast("Failed to delete","error"); }
  };

  const handleCheckout = async () => {
    if (!cart.length) { toast("Cart is empty","error"); return; }
    
    // Validation
    const invalidItems = cart.filter(item => item.qty <= 0 || item.qty > item.stock);
    if (invalidItems.length > 0) {
      toast("Some items have invalid quantities or insufficient stock","error");
      return;
    }

    try {
      await apiClient.post('/canteen/checkout', { items: cart.map(i => ({ id:i.id, qty:i.qty })) });
      toast(`Sale completed: EGP ${total}`,"success");
      setCart([]); fetchProducts();
    } catch(e: any) { toast(e.message || "Checkout failed","error"); }
  };

  return (
    <div className="fade-in">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "pos" && (
        <div className="pos-grid">
          <div className="pos-products">
            <div className="filter-bar">
              <SearchBar value={search} onChange={setSearch} placeholder="Search product..." />
            </div>
            <div className="product-grid">
              {loading ? <div style={{ padding:40, color:'var(--text3)' }}>Loading...</div> : filtered.map(p => (
                <div key={p.id} className={`product-card ${p.stock<=10?"low":""}`} onClick={() => addToCart(p)}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{CATEGORY_EMOJI[p.category]||"🍽️"}</div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{p.name}</div>
                  <div style={{ color:"var(--primary)", fontWeight:700, marginTop:4 }}>EGP {p.price}</div>
                  {p.stock<=10 && <span className="badge-status badge-low" style={{ marginTop:4, justifyContent:"center", fontSize:11 }}>Low: {p.stock}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="pos-cart">
            <div style={{ padding:16, borderBottom:"1px solid var(--border)", fontFamily:"Sora,sans-serif", fontWeight:700 }}>
              Shopping Cart {cart.length>0&&<span style={{ background:"var(--primary)", color:"white", borderRadius:12, padding:"1px 8px", fontSize:12 }}>{cart.length}</span>}
            </div>
            <div style={{ flex:1, overflowY:"auto" }}>
              {cart.length===0 ? (
                <div style={{ padding:32, textAlign:"center", color:"var(--text3)" }}><div style={{ fontSize:40, marginBottom:8 }}>🛒</div><div>Cart is empty</div></div>
              ) : cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:500 }}>{item.name}</div>
                    <div style={{ fontSize:12, color:"var(--text3)" }}>EGP {item.price} each</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button className="btn btn-xs btn-secondary" onClick={() => updateQty(item.id,-1)}>−</button>
                    <span style={{ fontWeight:600, width:20, textAlign:"center" }}>{item.qty}</span>
                    <button className="btn btn-xs btn-secondary" onClick={() => updateQty(item.id,1)}>+</button>
                  </div>
                  <div style={{ fontWeight:600, color:"var(--primary)", marginLeft:12, minWidth:60, textAlign:"right" }}>EGP {item.price*item.qty}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:16, borderTop:"1px solid var(--border)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16, fontSize:18, fontWeight:700, fontFamily:"Sora,sans-serif" }}>
                <span>Total</span><span style={{ color:"var(--primary)" }}>EGP {total}</span>
              </div>
              <button className="btn btn-primary" style={{ width:"100%", justifyContent:"center", padding:"12px" }} onClick={handleCheckout}>
                Complete Sale
              </button>
              {cart.length>0&&<button className="btn btn-secondary" style={{ width:"100%", marginTop:8, justifyContent:"center" }} onClick={() => setCart([])}>Clear Cart</button>}
            </div>
          </div>
        </div>
      )}

      {tab === "dashboard" && (
        <div>
          <div className="kpi-grid" style={{ gridTemplateColumns:"repeat(4,1fr)" }}>
            <KPICard icon="canteen"  label="Total Revenue"  value={`EGP ${((summary?.totalRevenue||0)/1000).toFixed(0)}K`} color="#F57C00" bg="rgba(245,124,0,0.1)" />
            <KPICard icon="canteen"  label="Today Sales"    value={`EGP ${summary?.todaySales||0}`}                        color="#0055A5" bg="rgba(0,85,165,0.1)" />
            <KPICard icon="trend"    label="Total Products" value={summary?.totalItems ?? '—'}                             color="#2E7D32" bg="rgba(46,125,50,0.1)" />
            <KPICard icon="alert"    label="Low Stock"      value={summary?.lowStock ?? '—'}                               color="#C62828" bg="rgba(198,40,40,0.1)" />
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Hourly Revenue Today</span></div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize:12, fill:"var(--text3)" }} />
                <YAxis tick={{ fontSize:12, fill:"var(--text3)" }} />
                <Tooltip formatter={(v: number) => `EGP ${v}`} />
                <Bar dataKey="revenue" fill="#0055A5" radius={[4,4,0,0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === "products" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Product Management</span>
            <button className="btn btn-primary btn-sm" onClick={() => openProductModal()}><Icon name="plus" size={14} />Add Product</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>Category</th><th>Price (EGP)</th><th>Stock</th><th>Total Sales</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight:500 }}>{p.name}</td>
                    <td><span style={{ background:"var(--accent2)", color:"var(--primary)", padding:"2px 8px", borderRadius:12, fontSize:12 }}>{p.category}</span></td>
                    <td style={{ fontWeight:600 }}>{p.price}</td>
                    <td><span style={{ color:p.stock<=10?"var(--danger)":"var(--text)", fontWeight:p.stock<=10?700:400 }}>{p.stock} {p.stock<=10&&"⚠️"}</span></td>
                    <td>{p.sales.toLocaleString()}</td>
                    <td><Badge status={p.stock===0?"Inactive":"Active"} /></td>
                    <td>
                      <div style={{ display:"flex", gap:4 }}>
                        <button className="btn btn-xs btn-secondary" onClick={() => openProductModal(p)}><Icon name="edit" size={12} /></button>
                        <button className="btn btn-xs btn-danger" onClick={() => handleDeleteProduct(p)}><Icon name="trash" size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      <Modal open={showProductModal} onClose={() => { setShowProductModal(false); setEditProduct(null); }}
        title={editProduct ? `Edit Product — ${editProduct.name}` : "Add New Product"}
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowProductModal(false); setEditProduct(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveProduct}>{editProduct ? "Save Changes" : "Add Product"}</button>
        </>}
      >
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div className="form-group"><label className="form-label">Product Name *</label><input ref={prodNameRef} className="form-input" placeholder="e.g., Water Bottle 500ml" /></div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Category *</label>
              <select ref={prodCatRef} className="form-input">
                {Object.keys(CATEGORY_EMOJI).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Price (EGP) *</label>
              <input ref={prodPriceRef} className="form-input" type="number" step="0.5" min="0" placeholder="0.00" />
            </div>
          </div>
          <div className="form-group"><label className="form-label">Initial Stock *</label>
            <input ref={prodStockRef} className="form-input" type="number" min="0" placeholder="0" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
