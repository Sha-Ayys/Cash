import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const IDR = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const tsNow = () => new Date().toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const C = {
  bg: "#0e0e10", sidebar: "#111113", card: "#19191d", surface: "#222228",
  border: "#2c2c33", gold: "#f0a500", goldDim: "#b37a00", red: "#e84545",
  green: "#22c55e", text: "#f4f0e8", muted: "#6b6b75", mono: "'JetBrains Mono', monospace",
};

const btn = (v = "primary", extra = {}) => ({
  padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer",
  fontWeight: 700, fontSize: 13, transition: "all 0.12s", fontFamily: "inherit",
  background: v === "primary" ? C.gold : v === "danger" ? C.red : v === "green" ? C.green : C.surface,
  color: v === "primary" ? "#000" : v === "green" ? "#000" : C.text,
  ...extra,
});
const inp = (extra = {}) => ({
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "9px 13px", fontSize: 14, outline: "none",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", ...extra,
});
const th = (extra = {}) => ({
  padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: 11,
  color: C.muted, borderBottom: `1px solid ${C.border}`, cursor: "pointer",
  whiteSpace: "nowrap", letterSpacing: "0.05em", ...extra,
});
const td = (extra = {}) => ({
  padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 13, ...extra,
});

export default function KasirApp() {
  const [tab, setTab] = useState("pos");
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [cart, setCart] = useState([]);
  const [prodForm, setProdForm] = useState({ id: null, name: "", price: "", barcode: "", stock: "", category: "" });
  const [showProdForm, setShowProdForm] = useState(false);
  const [searchProd, setSearchProd] = useState("");
  const [cartSearch, setCartSearch] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [reportType, setReportType] = useState("sold");
  const [sortCol, setSortCol] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [notif, setNotif] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get("kasir_prods"); if (r) setProducts(JSON.parse(r.value)); } catch {}
      try { const r = await window.storage.get("kasir_txns"); if (r) setTransactions(JSON.parse(r.value)); } catch {}
      setLoaded(true);
    })();
  }, []);

  const notify = (msg, type = "ok") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 2600);
  };

  const saveProds = async (d) => {
    setProducts(d);
    try { await window.storage.set("kasir_prods", JSON.stringify(d)); } catch {}
  };
  const saveTxns = async (d) => {
    setTransactions(d);
    try { await window.storage.set("kasir_txns", JSON.stringify(d)); } catch {}
  };

  // ── Products ───────────────────────────────────────
  const submitProd = () => {
    if (!prodForm.name.trim() || !prodForm.price) { notify("Nama & harga wajib diisi", "err"); return; }
    const item = {
      id: prodForm.id || uid(),
      name: prodForm.name.trim(),
      price: parseFloat(String(prodForm.price).replace(/\D/g, "")),
      barcode: prodForm.barcode.trim(),
      stock: parseInt(prodForm.stock) || 0,
      category: prodForm.category.trim(),
    };
    const updated = prodForm.id ? products.map(p => p.id === prodForm.id ? item : p) : [...products, item];
    saveProds(updated);
    setProdForm({ id: null, name: "", price: "", barcode: "", stock: "", category: "" });
    setShowProdForm(false);
    notify(prodForm.id ? "Barang diperbarui ✓" : "Barang ditambahkan ✓");
  };

  const editProd = (p) => {
    setProdForm({ id: p.id, name: p.name, price: p.price, barcode: p.barcode, stock: p.stock, category: p.category || "" });
    setShowProdForm(true);
  };

  const delProd = (id) => {
    saveProds(products.filter(p => p.id !== id));
    notify("Barang dihapus", "err");
    setConfirmDel(null);
  };

  // ── Cart ───────────────────────────────────────────
  const addToCart = (prod) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === prod.id);
      if (ex) return prev.map(c => c.id === prod.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: prod.id, name: prod.name, price: prod.price, qty: 1 }];
    });
  };

  const removeCart = (id) => setCart(prev => prev.filter(c => c.id !== id));
  const updateQty = (id, qty) => {
    if (qty <= 0) removeCart(id);
    else setCart(prev => prev.map(c => c.id === id ? { ...c, qty } : c));
  };
  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const handleBarcodeKey = (e) => {
    if (e.key === "Enter") {
      const val = cartSearch.trim();
      if (!val) return;
      const found = products.find(p => p.barcode === val || p.name.toLowerCase().includes(val.toLowerCase()));
      if (found) { addToCart(found); notify(`${found.name} ditambahkan`); setCartSearch(""); }
      else notify("Barang tidak ditemukan", "err");
    }
  };

  const processPayment = () => {
    const paid = parseFloat(String(payAmount).replace(/[^0-9]/g, ""));
    if (isNaN(paid) || paid < cartTotal) { notify("Jumlah bayar kurang", "err"); return; }
    const rec = { id: uid(), date: tsNow(), items: cart.map(c => ({ ...c })), total: cartTotal, paid, change: paid - cartTotal };
    saveTxns([rec, ...transactions]);
    setReceipt(rec);
    setCart([]);
    setPayAmount("");
    setShowPay(false);
  };

  // ── Report ─────────────────────────────────────────
  const soldMap = transactions.flatMap(t => t.items).reduce((acc, item) => {
    if (!acc[item.id]) acc[item.id] = { id: item.id, name: item.name, price: item.price, qty: 0, total: 0 };
    acc[item.id].qty += item.qty;
    acc[item.id].total += item.price * item.qty;
    return acc;
  }, {});
  const soldItems = Object.values(soldMap);

  const reportRows = reportType === "sold"
    ? soldItems
    : products.map(p => ({ id: p.id, name: p.name, price: p.price, qty: p.stock, total: p.price * p.stock }));

  const sortedRows = [...reportRows].sort((a, b) => {
    const m = sortAsc ? 1 : -1;
    if (sortCol === "name") return m * a.name.localeCompare(b.name);
    return m * ((a[sortCol] || 0) - (b[sortCol] || 0));
  });

  const grandTotal = sortedRows.reduce((s, r) => s + (r.total || 0), 0);
  const toggleSort = (col) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };

  const exportExcel = () => {
    const label = reportType === "sold" ? "Barang Terjual" : "Stok Tersedia";
    const ws = XLSX.utils.json_to_sheet(sortedRows.map(r => ({
      "Nama Barang": r.name, "Harga Satuan (Rp)": r.price,
      [reportType === "sold" ? "Terjual" : "Stok"]: r.qty,
      "Total (Rp)": r.total,
    })));
    ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, label);
    // Summary sheet
    const txSheet = XLSX.utils.json_to_sheet(transactions.map(t => ({
      "Tanggal": t.date, "Total": t.total, "Bayar": t.paid, "Kembalian": t.change,
      "Jumlah Item": t.items.reduce((s, i) => s + i.qty, 0),
    })));
    XLSX.utils.book_append_sheet(wb, txSheet, "Riwayat Transaksi");
    XLSX.writeFile(wb, `laporan_kasir_${Date.now()}.xlsx`);
    notify("File Excel diunduh ✓");
  };

  const exportWord = () => {
    const label = reportType === "sold" ? "Barang Terjual" : "Stok Tersedia";
    const rows = sortedRows.map(r =>
      `<tr><td>${r.name}</td><td class="num">${IDR(r.price)}</td><td class="num">${r.qty}</td><td class="num">${IDR(r.total)}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Calibri, Arial; font-size: 11pt; margin: 2.5cm; color: #1a1a1a; }
  h1 { font-size: 18pt; margin-bottom: 4px; color: #0d0d0d; }
  .sub { font-size: 10pt; color: #555; margin-bottom: 20pt; }
  table { border-collapse: collapse; width: 100%; margin-top: 10pt; }
  thead tr { background: #1a1a1a; color: white; }
  th { padding: 9px 12px; text-align: left; font-size: 10pt; }
  td { border: 1px solid #ddd; padding: 7px 12px; font-size: 10pt; }
  .num { text-align: right; font-family: 'Courier New'; }
  tr:nth-child(even) { background: #f9f9f9; }
  .foot { font-weight: bold; background: #fff8e1; }
  .summary { margin-top: 20pt; display: flex; gap: 20pt; }
  .sum-box { border: 1px solid #ddd; padding: 10pt; border-radius: 4pt; min-width: 120pt; }
  .sum-label { font-size: 9pt; color: #777; }
  .sum-val { font-size: 14pt; font-weight: bold; font-family: 'Courier New'; }
</style></head><body>
<h1>Laporan Kasir — ${label}</h1>
<div class="sub">Dicetak: ${tsNow()} &nbsp;|&nbsp; Total ${sortedRows.length} item</div>
<div class="summary">
  <div class="sum-box"><div class="sum-label">TOTAL ITEM</div><div class="sum-val">${sortedRows.length}</div></div>
  <div class="sum-box"><div class="sum-label">TOTAL UNIT</div><div class="sum-val">${sortedRows.reduce((s, r) => s + (r.qty || 0), 0)}</div></div>
  <div class="sum-box"><div class="sum-label">GRAND TOTAL</div><div class="sum-val">${IDR(grandTotal)}</div></div>
</div>
<table>
<thead><tr><th>Nama Barang</th><th>Harga Satuan</th><th>${reportType === "sold" ? "Terjual" : "Stok"}</th><th>Total</th></tr></thead>
<tbody>${rows}
<tr class="foot"><td colspan="3">GRAND TOTAL</td><td class="num">${IDR(grandTotal)}</td></tr>
</tbody></table>
</body></html>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `laporan_kasir_${Date.now()}.doc`;
    a.click();
    notify("File Word diunduh ✓");
  };

  const posProducts = products.filter(p =>
    p.name.toLowerCase().includes(cartSearch.toLowerCase()) || (p.barcode && p.barcode.includes(cartSearch))
  );
  const filteredProds = products.filter(p =>
    p.name.toLowerCase().includes(searchProd.toLowerCase()) || (p.barcode && p.barcode.includes(searchProd))
  );

  if (!loaded) return <div style={{ background: C.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>Memuat data…</div>;

  const NAV = [
    { id: "pos", icon: "⊞", label: "Kasir" },
    { id: "products", icon: "◫", label: "Barang" },
    { id: "report", icon: "◳", label: "Laporan" },
    { id: "history", icon: "≡", label: "Riwayat" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body,html{height:100%}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
        input::placeholder{color:${C.muted}}
        input:focus,textarea:focus{border-color:${C.gold}!important;box-shadow:0 0 0 2px ${C.gold}20}
        @keyframes fadeSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .prod-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(240,165,0,0.12)}
        .row-hover:hover{background:${C.surface}}
        .nav-btn:hover{background:${C.surface}}
      `}</style>

      {/* Toast */}
      {notif && (
        <div style={{ position: "fixed", top: 18, right: 18, zIndex: 9999, background: notif.type === "err" ? C.red : C.green, color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, animation: "fadeSlide 0.2s ease", fontFamily: "Syne, sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          {notif.msg}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, animation: "fadeIn 0.15s" }}>
          <div style={{ background: C.card, borderRadius: 14, padding: 28, width: 320, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Hapus Barang?</h3>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Barang <strong style={{ color: C.text }}>{confirmDel.name}</strong> akan dihapus permanen.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={btn("ghost", { flex: 1 })} onClick={() => setConfirmDel(null)}>Batal</button>
              <button style={btn("danger", { flex: 1 })} onClick={() => delProd(confirmDel.id)}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showPay && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, animation: "fadeIn 0.15s" }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 28, width: 360, border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Proses Pembayaran</h3>
            <div style={{ background: C.surface, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>TOTAL TAGIHAN</div>
              <div style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 700, color: C.gold }}>{IDR(cartTotal)}</div>
            </div>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>JUMLAH BAYAR</label>
            <input style={inp({ fontSize: 20, fontFamily: C.mono, marginBottom: 10 })}
              type="number" value={payAmount} autoFocus
              onChange={e => setPayAmount(e.target.value)}
              onKeyDown={e => e.key === "Enter" && processPayment()}
              placeholder="0"
            />
            {payAmount && parseFloat(payAmount) >= cartTotal && (
              <div style={{ background: "rgba(34,197,94,0.1)", border: `1px solid rgba(34,197,94,0.3)`, borderRadius: 8, padding: "8px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>Kembalian</span>
                <span style={{ color: C.green, fontFamily: C.mono, fontWeight: 700 }}>{IDR(parseFloat(payAmount) - cartTotal)}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {[50000, 100000, 200000, 500000].map(v => (
                <button key={v} style={btn("ghost", { padding: "6px 10px", fontSize: 11, flex: 1 })} onClick={() => setPayAmount(v)}>
                  {IDR(v)}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={btn("ghost", { flex: 1 })} onClick={() => setShowPay(false)}>Batal</button>
              <button style={btn("primary", { flex: 2 })} onClick={processPayment}>Proses Bayar →</button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receipt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, animation: "fadeIn 0.15s" }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 28, width: 340, border: `1px solid ${C.border}` }}>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>Pembayaran Berhasil</h3>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 4, fontFamily: C.mono }}>{receipt.date}</div>
            </div>
            <div style={{ borderTop: `1px dashed ${C.border}`, borderBottom: `1px dashed ${C.border}`, paddingBlock: 12, marginBottom: 12 }}>
              {receipt.items.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: C.muted }}>{item.name} <strong style={{ color: C.text }}>×{item.qty}</strong></span>
                  <span style={{ fontFamily: C.mono }}>{IDR(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
            {[["Total", IDR(receipt.total), C.gold], ["Bayar", IDR(receipt.paid), C.text], ["Kembalian", IDR(receipt.change), C.green]].map(([l, v, col]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: l === "Total" ? 800 : 400, color: C.muted }}>{l}</span>
                <span style={{ fontFamily: C.mono, fontWeight: 700, color: col }}>{v}</span>
              </div>
            ))}
            <button style={btn("primary", { width: "100%", marginTop: 16 })} onClick={() => setReceipt(null)}>Tutup</button>
          </div>
        </div>
      )}

      {/* App Shell */}
      <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, fontFamily: "Syne, sans-serif", fontSize: 14, overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 60, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, gap: 2 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#000", marginBottom: 14 }}>K</div>
          {NAV.map(({ id, icon }) => (
            <button key={id} className="nav-btn" title={id}
              style={{ width: 44, height: 44, borderRadius: 10, border: "none", cursor: "pointer", background: tab === id ? C.gold : "transparent", color: tab === id ? "#000" : C.muted, fontSize: 18, transition: "all 0.12s", display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => setTab(id)}>{icon}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ marginBottom: 14, fontSize: 10, color: C.muted, textAlign: "center", lineHeight: 1.4 }}>
            <div>{products.length}</div><div style={{ fontSize: 9 }}>item</div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ height: 54, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", paddingInline: 22, gap: 10, background: C.sidebar }}>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>
              {tab === "pos" ? "Kasir" : tab === "products" ? "Data Barang" : tab === "report" ? "Laporan" : "Riwayat Transaksi"}
            </span>
            {tab === "pos" && cart.length > 0 && (
              <span style={{ background: C.gold, color: "#000", borderRadius: 12, padding: "1px 9px", fontSize: 11, fontWeight: 800 }}>{cart.length} item</span>
            )}
            <span style={{ marginLeft: "auto", color: C.muted, fontSize: 11, fontFamily: C.mono }}>
              {transactions.length} txn · {products.length} barang
            </span>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
            {tab === "pos" && <POS />}
            {tab === "products" && <Products />}
            {tab === "report" && <Report />}
            {tab === "history" && <History />}
          </div>
        </div>
      </div>
    </>
  );

  // ══════════════════════════════════════════════════
  // POS TAB
  // ══════════════════════════════════════════════════
  function POS() {
    return (
      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 90px)" }}>
        {/* Product grid area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          <input style={inp()} placeholder="🔍  Cari nama / scan barcode (Enter untuk tambah)..."
            value={cartSearch} onChange={e => setCartSearch(e.target.value)} onKeyDown={handleBarcodeKey} autoFocus
          />
          <div style={{ flex: 1, overflowY: "auto" }}>
            {posProducts.length === 0 && (
              <div style={{ color: C.muted, textAlign: "center", paddingTop: 60, fontSize: 13 }}>
                {products.length === 0 ? "Belum ada barang — tambah di tab Barang" : "Tidak ada barang yang cocok"}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
              {posProducts.map(p => {
                const inCart = cart.find(c => c.id === p.id);
                return (
                  <div key={p.id} className="prod-card"
                    style={{ background: inCart ? C.gold : C.card, border: `1px solid ${inCart ? C.gold : C.border}`, borderRadius: 10, padding: "14px 12px", cursor: "pointer", transition: "all 0.12s", position: "relative" }}
                    onClick={() => addToCart(p)}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>📦</div>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 5, color: inCart ? "#000" : C.text, lineHeight: 1.3 }}>{p.name}</div>
                    <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 600, color: inCart ? "#000" : C.gold }}>{IDR(p.price)}</div>
                    {inCart && (
                      <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.2)", color: "#000", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>×{inCart.qty}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cart panel */}
        <div style={{ width: 300, background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            Keranjang
            {cart.length > 0 && <span style={{ background: C.gold, color: "#000", borderRadius: 12, padding: "0px 8px", fontSize: 10, fontWeight: 800 }}>{cart.reduce((s, c) => s + c.qty, 0)}</span>}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
            {cart.length === 0 && <div style={{ color: C.muted, textAlign: "center", paddingTop: 50, fontSize: 12 }}>Keranjang kosong<br />Klik barang untuk menambahkan</div>}
            {cart.map(item => (
              <div key={item.id} style={{ background: C.surface, borderRadius: 9, padding: "10px 12px", marginBottom: 8, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{item.name}</div>
                    <div style={{ color: C.gold, fontFamily: C.mono, fontSize: 11 }}>{IDR(item.price)}</div>
                  </div>
                  <button onClick={() => removeCart(item.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 0 0 6px" }}>×</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>−</button>
                  <span style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 13, minWidth: 26, textAlign: "center" }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>+</button>
                  <span style={{ marginLeft: "auto", fontFamily: C.mono, fontSize: 12, fontWeight: 700 }}>{IDR(item.price * item.qty)}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: C.muted, fontSize: 11 }}>{cart.reduce((s, c) => s + c.qty, 0)} unit · {cart.length} jenis</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 800, fontFamily: C.mono, color: C.gold, marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: C.muted, fontFamily: "Syne", marginTop: 4 }}>Total</span>
              <span>{IDR(cartTotal)}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btn("danger", { flex: 1, fontSize: 12 })} onClick={() => setCart([])}>Batal</button>
              <button style={btn("primary", { flex: 2 })} onClick={() => cart.length > 0 && setShowPay(true)} disabled={cart.length === 0}>Bayar →</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // PRODUCTS TAB
  // ══════════════════════════════════════════════════
  function Products() {
    return (
      <div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
          <input style={inp({ maxWidth: 260 })} placeholder="🔍  Cari barang atau barcode..." value={searchProd} onChange={e => setSearchProd(e.target.value)} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={btn("primary")} onClick={() => { setProdForm({ id: null, name: "", price: "", barcode: "", stock: "", category: "" }); setShowProdForm(!showProdForm); }}>
              + Tambah Barang
            </button>
          </div>
        </div>

        {showProdForm && (
          <div style={{ background: C.card, border: `1px solid ${C.gold}40`, borderRadius: 12, padding: 20, marginBottom: 16, animation: "fadeSlide 0.15s" }}>
            <h4 style={{ marginBottom: 16, fontWeight: 800, fontSize: 15 }}>{prodForm.id ? "✏️ Edit Barang" : "➕ Tambah Barang Baru"}</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { key: "name", label: "NAMA BARANG *", ph: "Nama produk", type: "text" },
                { key: "price", label: "HARGA (Rp) *", ph: "Contoh: 15000", type: "number" },
                { key: "barcode", label: "BARCODE / SKU", ph: "Scan atau ketik", type: "text" },
                { key: "stock", label: "STOK AWAL", ph: "0", type: "number" },
                { key: "category", label: "KATEGORI", ph: "Minuman, Makanan, dll", type: "text" },
              ].map(({ key, label, ph, type }) => (
                <div key={key} style={key === "category" ? { gridColumn: "1 / -1" } : {}}>
                  <label style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 5, letterSpacing: "0.06em" }}>{label}</label>
                  <input style={inp()} type={type} placeholder={ph}
                    value={prodForm[key]} onChange={e => setProdForm(f => ({ ...f, [key]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && key === "category" && submitProd()}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={btn("ghost")} onClick={() => setShowProdForm(false)}>Batal</button>
              <button style={btn("primary")} onClick={submitProd}>💾 Simpan Barang</button>
            </div>
          </div>
        )}

        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.surface }}>
                <th style={th()}>NAMA BARANG</th>
                <th style={th({ textAlign: "right" })}>HARGA</th>
                <th style={th({ textAlign: "center" })}>STOK</th>
                <th style={th()}>KATEGORI</th>
                <th style={th()}>BARCODE</th>
                <th style={th({ textAlign: "center" })}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filteredProds.length === 0 && (
                <tr><td colSpan={6} style={td({ textAlign: "center", color: C.muted, padding: 36 })}>
                  {products.length === 0 ? "Belum ada barang — klik Tambah Barang" : "Tidak ada hasil pencarian"}
                </td></tr>
              )}
              {filteredProds.map(p => (
                <tr key={p.id} className="row-hover" style={{ transition: "background 0.1s" }}>
                  <td style={td({ fontWeight: 700 })}>{p.name}</td>
                  <td style={td({ textAlign: "right", fontFamily: C.mono, color: C.gold, fontWeight: 600 })}>{IDR(p.price)}</td>
                  <td style={td({ textAlign: "center" })}>
                    <span style={{ background: p.stock > 0 ? "rgba(34,197,94,0.15)" : "rgba(232,69,69,0.15)", color: p.stock > 0 ? C.green : C.red, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700, fontFamily: C.mono }}>{p.stock}</span>
                  </td>
                  <td style={td({ color: C.muted, fontSize: 12 })}>{p.category || "—"}</td>
                  <td style={td({ color: C.muted, fontFamily: C.mono, fontSize: 11 })}>{p.barcode || "—"}</td>
                  <td style={td({ textAlign: "center" })}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button style={btn("ghost", { padding: "5px 12px", fontSize: 11 })} onClick={() => editProd(p)}>✏️ Edit</button>
                      <button style={btn("danger", { padding: "5px 12px", fontSize: 11 })} onClick={() => setConfirmDel(p)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // REPORT TAB
  // ══════════════════════════════════════════════════
  function Report() {
    return (
      <div>
        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: C.surface, borderRadius: 10, padding: 3, border: `1px solid ${C.border}` }}>
            {[{ v: "sold", l: "Barang Terjual" }, { v: "available", l: "Stok Tersedia" }].map(({ v, l }) => (
              <button key={v} style={{ padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: reportType === v ? C.gold : "transparent", color: reportType === v ? "#000" : C.muted, transition: "all 0.12s", fontFamily: "inherit" }}
                onClick={() => setReportType(v)}>{l}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: C.muted, fontSize: 11 }}>Urut:</span>
            {[["name", "Nama"], ["price", "Harga"], ["qty", "Jumlah"], ["total", "Total"]].map(([col, lbl]) => (
              <button key={col} style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${sortCol === col ? C.gold : C.border}`, background: "transparent", color: sortCol === col ? C.gold : C.muted, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}
                onClick={() => toggleSort(col)}>{lbl}{sortCol === col ? (sortAsc ? " ↑" : " ↓") : ""}</button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={btn("ghost", { fontSize: 12 })} onClick={exportExcel}>📊 Ekspor Excel</button>
            <button style={btn("ghost", { fontSize: 12 })} onClick={exportWord}>📝 Ekspor Word</button>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { label: "TOTAL ITEM", val: sortedRows.length, mono: false },
            { label: "TOTAL UNIT", val: sortedRows.reduce((s, r) => s + (r.qty || 0), 0), mono: true },
            { label: "GRAND TOTAL", val: IDR(grandTotal), mono: true, gold: true },
          ].map(({ label, val, mono, gold }) => (
            <div key={label} style={{ background: C.card, borderRadius: 10, padding: "16px 18px", border: `1px solid ${C.border}` }}>
              <div style={{ color: C.muted, fontSize: 10, marginBottom: 6, letterSpacing: "0.06em" }}>{label}</div>
              <div style={{ fontFamily: mono ? C.mono : "Syne", fontSize: gold ? 19 : 24, fontWeight: 700, color: gold ? C.gold : C.text }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.surface }}>
                <th style={th()} onClick={() => toggleSort("name")}>NAMA BARANG {sortCol === "name" ? (sortAsc ? "↑" : "↓") : ""}</th>
                <th style={th({ textAlign: "right" })} onClick={() => toggleSort("price")}>HARGA SATUAN {sortCol === "price" ? (sortAsc ? "↑" : "↓") : ""}</th>
                <th style={th({ textAlign: "center" })} onClick={() => toggleSort("qty")}>{reportType === "sold" ? "TERJUAL" : "STOK"} {sortCol === "qty" ? (sortAsc ? "↑" : "↓") : ""}</th>
                <th style={th({ textAlign: "right" })} onClick={() => toggleSort("total")}>TOTAL {sortCol === "total" ? (sortAsc ? "↑" : "↓") : ""}</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr><td colSpan={4} style={td({ textAlign: "center", color: C.muted, padding: 40 })}>Belum ada data</td></tr>
              )}
              {sortedRows.map((r, i) => (
                <tr key={r.id || i} className="row-hover">
                  <td style={td({ fontWeight: 600 })}>{r.name}</td>
                  <td style={td({ textAlign: "right", fontFamily: C.mono, color: C.muted, fontSize: 12 })}>{IDR(r.price)}</td>
                  <td style={td({ textAlign: "center", fontFamily: C.mono, fontWeight: 700 })}>{r.qty}</td>
                  <td style={td({ textAlign: "right", fontFamily: C.mono, fontWeight: 700, color: C.gold })}>{IDR(r.total)}</td>
                </tr>
              ))}
              {sortedRows.length > 0 && (
                <tr style={{ background: C.surface }}>
                  <td colSpan={3} style={td({ fontWeight: 800, fontSize: 13 })}>GRAND TOTAL</td>
                  <td style={td({ textAlign: "right", fontFamily: C.mono, fontWeight: 800, fontSize: 15, color: C.gold })}>{IDR(grandTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // HISTORY TAB
  // ══════════════════════════════════════════════════
  function History() {
    const dayTotal = transactions.reduce((s, t) => s + t.total, 0);
    return (
      <div>
        {transactions.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { l: "TRANSAKSI HARI INI", v: transactions.length },
              { l: "TOTAL PENDAPATAN", v: IDR(dayTotal), gold: true },
              { l: "RATA-RATA TRANSAKSI", v: IDR(Math.round(dayTotal / transactions.length)), gold: true },
            ].map(({ l, v, gold }) => (
              <div key={l} style={{ background: C.card, borderRadius: 10, padding: "14px 18px", border: `1px solid ${C.border}` }}>
                <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>{l}</div>
                <div style={{ fontFamily: C.mono, fontSize: 18, fontWeight: 700, color: gold ? C.gold : C.text }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: C.muted, fontSize: 12 }}>{transactions.length} transaksi tersimpan</span>
          {transactions.length > 0 && (
            <button style={btn("danger", { fontSize: 11, padding: "6px 12px" })} onClick={() => { if (window.confirm("Hapus semua riwayat transaksi?")) saveTxns([]); }}>
              🗑️ Hapus Semua
            </button>
          )}
        </div>

        {transactions.length === 0 && (
          <div style={{ color: C.muted, textAlign: "center", paddingTop: 60 }}>Belum ada transaksi tercatat</div>
        )}

        {transactions.map(t => (
          <div key={t.id} style={{ background: C.card, borderRadius: 12, padding: 16, marginBottom: 10, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>🧾 {t.date}</div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                  {t.items.length} jenis · {t.items.reduce((s, i) => s + i.qty, 0)} unit
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: C.mono, fontSize: 15, fontWeight: 700, color: C.gold }}>{IDR(t.total)}</div>
                <div style={{ color: C.green, fontSize: 11, fontFamily: C.mono }}>↩ {IDR(t.change)}</div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
              {t.items.map((item, i) => (
                <span key={i} style={{ fontSize: 11, color: C.muted }}>
                  {item.name} <strong style={{ color: C.text }}>×{item.qty}</strong>
                  <span style={{ fontFamily: C.mono, color: C.muted }}> {IDR(item.price * item.qty)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
}
