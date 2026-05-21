let products = [];
let cart = [];
let selectedPayment = 'Tunai';
let qrisConfig = { image: '', merchant_name: 'Toko Saya' };
let pendingTrx = null;

// ─── INIT ───────────────────────────────────────────────────────────────
async function init() {
  await loadProducts();
  await loadQris();
  renderProductGrid();
  renderProductTable();
  loadReport();
}

async function loadProducts() {
  const r = await fetch('/api/products');
  products = await r.json();
  populateCategoryFilter();
}

async function loadQris() {
  const r = await fetch('/api/qris');
  qrisConfig = await r.json();
  if (document.getElementById('merchant-name')) {
    document.getElementById('merchant-name').value = qrisConfig.merchant_name || '';
  }
  if (qrisConfig.image) {
    document.getElementById('qris-preview').innerHTML = `<img src="${qrisConfig.image}">`;
  }
}

// ─── PAGES ───────────────────────────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  event.currentTarget.classList.add('active');
  if (page === 'laporan') loadReport();
  if (page === 'produk') renderProductTable();
}

// ─── PRODUCTS ───────────────────────────────────────────────────────────
function populateCategoryFilter() {
  const cats = [...new Set(products.map(p => p.category || 'Umum'))];
  const sel = document.getElementById('filter-cat');
  sel.innerHTML = '<option value="">Semua Kategori</option>';
  cats.forEach(c => { sel.innerHTML += `<option value="${c}">${c}</option>`; });
}

function filterProducts() {
  renderProductGrid();
}

function renderProductGrid() {
  const grid = document.getElementById('product-grid');
  const q = document.getElementById('search-product').value.toLowerCase();
  const cat = document.getElementById('filter-cat').value;
  const filtered = products.filter(p => {
    const matchQ = p.name.toLowerCase().includes(q);
    const matchC = !cat || (p.category || 'Umum') === cat;
    return matchQ && matchC;
  });
  if (!filtered.length) {
    grid.innerHTML = '<div style="color:var(--text-muted);font-size:13px;grid-column:1/-1;text-align:center;padding:40px">Tidak ada produk</div>';
    return;
  }
  grid.innerHTML = filtered.map(p => `
    <div class="product-card ${p.stock <= 0 ? 'out-of-stock' : ''}" onclick="addToCart(${p.id})">
      <div class="prod-cat">${p.category || 'Umum'}</div>
      <div class="prod-name">${p.name}</div>
      <div class="prod-price">${fmtRp(p.price)}</div>
      <div class="prod-stock">Stok: ${p.stock ?? '∞'}</div>
    </div>
  `).join('');
}

function renderProductTable() {
  const tbody = document.getElementById('product-tbody');
  if (!tbody) return;
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td><span class="badge badge-info">${p.category || 'Umum'}</span></td>
      <td class="price-cell">${fmtRp(p.price)}</td>
      <td>${p.stock ?? 0}</td>
      <td>${p.sold ?? 0}</td>
      <td>
        <button class="btn-edit" onclick="openProductModal(${p.id})">Edit</button>
        <button class="btn-danger" onclick="deleteProduct(${p.id})">Hapus</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">Belum ada produk</td></tr>';
}

function openProductModal(id) {
  document.getElementById('modal-product-title').textContent = id ? 'Edit Produk' : 'Tambah Produk';
  document.getElementById('edit-product-id').value = id || '';
  if (id) {
    const p = products.find(x => x.id === id);
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-price').value = p.price;
    document.getElementById('prod-stock').value = p.stock ?? 0;
    document.getElementById('prod-category').value = p.category || 'Umum';
  } else {
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-price').value = '';
    document.getElementById('prod-stock').value = '';
    document.getElementById('prod-category').value = '';
  }
  openModal('modal-product');
}

async function saveProduct() {
  const id = document.getElementById('edit-product-id').value;
  const body = {
    name: document.getElementById('prod-name').value.trim(),
    price: parseFloat(document.getElementById('prod-price').value) || 0,
    stock: parseInt(document.getElementById('prod-stock').value) || 0,
    category: document.getElementById('prod-category').value.trim() || 'Umum'
  };
  if (!body.name) { toast('Nama produk harus diisi'); return; }
  const url = id ? `/api/products/${id}` : '/api/products';
  const method = id ? 'PUT' : 'POST';
  await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await loadProducts();
  renderProductGrid();
  renderProductTable();
  closeModal('modal-product');
  toast(id ? 'Produk diperbarui' : 'Produk ditambahkan');
}

async function deleteProduct(id) {
  if (!confirm('Hapus produk ini?')) return;
  await fetch(`/api/products/${id}`, { method: 'DELETE' });
  await loadProducts();
  renderProductGrid();
  renderProductTable();
  toast('Produk dihapus');
}

// ─── CART ────────────────────────────────────────────────────────────────
function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const existing = cart.find(c => c.id === id);
  if (existing) {
    if (p.stock > 0 && existing.qty >= p.stock) { toast('Stok tidak cukup'); return; }
    existing.qty++;
  } else {
    cart.push({ id: p.id, name: p.name, price: p.price, qty: 1 });
  }
  renderCart();
}

function updateQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
  renderCart();
}

function removeItem(id) {
  cart = cart.filter(c => c.id !== id);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function renderCart() {
  const el = document.getElementById('cart-items');
  if (!cart.length) { el.innerHTML = '<div class="cart-empty">Pilih produk untuk mulai</div>'; }
  else {
    el.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div style="flex:1">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${fmtRp(item.price)}</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" onclick="updateQty(${item.id}, -1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
        </div>
        <button class="remove-btn" onclick="removeItem(${item.id})">✕</button>
      </div>
    `).join('');
  }
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cart-total').textContent = fmtRp(total);
  calcChange();
}

// ─── PAYMENT ─────────────────────────────────────────────────────────────
function selectPayment(btn) {
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedPayment = btn.dataset.method;
  const cashArea = document.getElementById('cash-input-area');
  cashArea.style.display = selectedPayment === 'Tunai' ? 'block' : 'none';
}

function calcChange() {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const paid = parseFloat(document.getElementById('cash-paid').value) || 0;
  const change = paid - total;
  document.getElementById('change-amount').textContent = change >= 0 ? fmtRp(change) : '—';
}

function checkout() {
  if (!cart.length) { toast('Keranjang masih kosong'); return; }
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cashier = document.getElementById('cashier-name').value || 'Kasir';
  const paid = parseFloat(document.getElementById('cash-paid').value) || total;
  pendingTrx = { items: cart, total, payment_method: selectedPayment, amount_paid: paid, change: paid - total, cashier };

  if (selectedPayment === 'Tunai') {
    if (paid < total) { toast('Jumlah pembayaran kurang'); return; }
    showPaymentModal();
  } else if (selectedPayment === 'QRIS Scan') {
    showQrisScanModal(total);
  } else {
    showQrisDisplayModal(total);
  }
}

function showPaymentModal() {
  const { total, amount_paid, change } = pendingTrx;
  document.getElementById('payment-modal-title').textContent = 'Konfirmasi Pembayaran Tunai';
  document.getElementById('payment-modal-body').innerHTML = `
    <div style="font-size:13px;line-height:2">
      <div style="display:flex;justify-content:space-between"><span>Total</span><strong>${fmtRp(total)}</strong></div>
      <div style="display:flex;justify-content:space-between"><span>Dibayar</span><strong>${fmtRp(amount_paid)}</strong></div>
      <div style="display:flex;justify-content:space-between;color:var(--success)"><span>Kembalian</span><strong>${fmtRp(change)}</strong></div>
    </div>
  `;
  openModal('modal-payment');
}

function showQrisScanModal(total) {
  document.getElementById('payment-modal-title').textContent = 'QRIS Scan';
  document.getElementById('payment-modal-body').innerHTML = `
    <div class="qris-display">
      ${qrisConfig.image ? `<img src="${qrisConfig.image}" alt="QRIS">` : '<div style="color:var(--text-muted);padding:20px">Belum ada gambar QRIS. Silakan atur di Pengaturan.</div>'}
      <div class="qris-name">${qrisConfig.merchant_name || 'Toko Saya'}</div>
      <div class="qris-amount">${fmtRp(total)}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:8px">Scan QR code di atas untuk membayar</div>
    </div>`;
  openModal('modal-payment');
}

function showQrisDisplayModal(total) {
  document.getElementById('payment-modal-title').textContent = 'QRIS Tampil';
  document.getElementById('payment-modal-body').innerHTML = `
    <div class="qris-display">
      ${qrisConfig.image ? `<img src="${qrisConfig.image}" alt="QRIS" style="max-width:280px">` : '<div style="color:var(--text-muted);padding:20px">Belum ada gambar QRIS. Silakan atur di Pengaturan.</div>'}
      <div class="qris-name">${qrisConfig.merchant_name || 'Toko Saya'}</div>
      <div class="qris-amount">${fmtRp(total)}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:8px">Tampilkan ke pelanggan untuk di-scan</div>
    </div>`;
  openModal('modal-payment');
}

async function confirmPayment() {
  if (!pendingTrx) return;
  const r = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pendingTrx)
  });
  const trx = await r.json();
  closeModal('modal-payment');
  showReceipt(trx);
  await loadProducts();
  renderProductGrid();
}

function showReceipt(trx) {
  const itemsHtml = trx.items.map(i => `
    <div class="receipt-item"><span>${i.name} x${i.qty}</span><span>${fmtRp(i.price * i.qty)}</span></div>
  `).join('');
  document.getElementById('receipt-body').innerHTML = `
    <div class="receipt">
      <div class="receipt-header">
        <div class="receipt-title">${qrisConfig.merchant_name || 'KasirPro'}</div>
        <div>${trx.date}</div>
        <div>Kasir: ${trx.cashier}</div>
      </div>
      ${itemsHtml}
      <div class="receipt-total">
        <div class="receipt-item"><span>TOTAL</span><span>${fmtRp(trx.total)}</span></div>
        <div class="receipt-item"><span>Dibayar (${trx.payment_method})</span><span>${fmtRp(trx.amount_paid)}</span></div>
        ${trx.change > 0 ? `<div class="receipt-item"><span>Kembalian</span><span>${fmtRp(trx.change)}</span></div>` : ''}
      </div>
      <div class="receipt-footer">Terima kasih atas kunjungan Anda!</div>
    </div>
  `;
  openModal('modal-receipt');
  pendingTrx = null;
}

// ─── REPORT ──────────────────────────────────────────────────────────────
async function loadReport() {
  const r = await fetch('/api/transactions');
  const transactions = await r.json();
  const totalRev = transactions.reduce((s, t) => s + t.total, 0);
  const totalItems = transactions.reduce((s, t) => s + t.items.reduce((a, i) => a + i.qty, 0), 0);
  const totalTrx = transactions.length;
  const avgTrx = totalTrx ? totalRev / totalTrx : 0;

  document.getElementById('summary-cards').innerHTML = `
    <div class="summary-card"><div class="card-label">Transaksi</div><div class="card-val">${totalTrx}</div></div>
    <div class="summary-card"><div class="card-label">Item Terjual</div><div class="card-val">${totalItems}</div></div>
    <div class="summary-card"><div class="card-label">Pendapatan</div><div class="card-val" style="font-size:16px">${fmtRp(totalRev)}</div></div>
    <div class="summary-card"><div class="card-label">Rata-rata</div><div class="card-val" style="font-size:16px">${fmtRp(avgTrx)}</div></div>
  `;

  // Sold products
  const soldProds = products.filter(p => p.sold > 0).sort((a,b) => b.sold - a.sold);
  document.getElementById('sold-tbody').innerHTML = soldProds.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.sold}</td>
      <td class="price-cell">${fmtRp(p.price)}</td>
      <td class="price-cell">${fmtRp(p.sold * p.price)}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">Belum ada penjualan</td></tr>';

  // Available products
  const availProds = products.filter(p => p.stock > 0);
  document.getElementById('avail-tbody').innerHTML = availProds.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td><span class="badge badge-info">${p.category || 'Umum'}</span></td>
      <td class="price-cell">${fmtRp(p.price)}</td>
      <td>
        <span class="badge ${p.stock > 10 ? 'badge-success' : 'badge-warning'}">${p.stock}</span>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">Tidak ada stok tersedia</td></tr>';

  // Transactions
  document.getElementById('trx-tbody').innerHTML = [...transactions].reverse().map(t => `
    <tr>
      <td>${t.date}</td>
      <td>${t.cashier || '-'}</td>
      <td><span class="badge badge-info">${t.payment_method}</span></td>
      <td class="price-cell">${fmtRp(t.total)}</td>
      <td class="price-cell">${fmtRp(t.amount_paid)}</td>
      <td class="price-cell">${fmtRp(t.change || 0)}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">Belum ada transaksi</td></tr>';
}

function showTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
}

// ─── EXPORT ──────────────────────────────────────────────────────────────
function exportFile(type) {
  window.open(`/api/export/${type}`, '_blank');
}

// ─── QRIS SETTINGS ───────────────────────────────────────────────────────
function previewQris() {
  const file = document.getElementById('qris-file').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('qris-preview').innerHTML = `<img src="${e.target.result}">`;
    qrisConfig.image = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveQris() {
  const name = document.getElementById('merchant-name').value;
  await fetch('/api/qris', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchant_name: name, image: qrisConfig.image })
  });
  qrisConfig.merchant_name = name;
  toast('Pengaturan QRIS disimpan');
}

// ─── MODAL ───────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── UTILS ───────────────────────────────────────────────────────────────
function fmtRp(n) {
  return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
  if (e.key === 'F2') document.getElementById('search-product').focus();
});

init();
