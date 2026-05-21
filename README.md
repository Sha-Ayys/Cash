# KasirPro — Aplikasi Kasir Python

Aplikasi kasir berbasis web menggunakan Flask. Mendukung manajemen produk, transaksi, laporan, dan ekspor data.

## Fitur

- ✅ Tambah / edit / hapus produk + harga + stok + kategori
- ✅ Keranjang belanja dengan update qty dan batalkan item
- ✅ Pembayaran: Tunai (hitung kembalian), QRIS Scan, QRIS Tampil
- ✅ Struk transaksi + cetak
- ✅ Laporan: produk terjual, stok tersedia, riwayat transaksi
- ✅ Ekspor ke Excel (.xlsx) dan Word (.docx)
- ✅ Simpan data lokal di `data.json`
- ✅ Upload gambar QRIS dari file

## Cara Jalankan Lokal

```bash
# 1. Clone repo
git clone https://github.com/USERNAME/kasirpro.git
cd kasirpro

# 2. Install dependencies
pip install -r requirements.txt

# 3. Jalankan
python app.py
```

Buka `http://localhost:5000`

## Deploy ke Vercel

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel

# 3. Ikuti instruksi — pilih Python saat diminta
```

Atau via GitHub:
1. Push repo ke GitHub
2. Buka https://vercel.com/new
3. Import repository
4. Framework: **Other**
5. Klik **Deploy**

> **Catatan Vercel**: Data disimpan di `data.json`. Di Vercel (serverless), file tidak persisten antar deployment. Untuk produksi, ganti penyimpanan ke database (misal: PlanetScale, Supabase, atau Vercel KV).

## Struktur File

```
kasirpro/
├── app.py              # Backend Flask
├── requirements.txt    # Dependencies
├── vercel.json         # Konfigurasi Vercel
├── data.json           # Data produk & transaksi (auto-generated)
├── templates/
│   └── index.html      # UI utama
└── static/
    ├── css/style.css   # Stylesheet
    └── js/app.js       # Frontend logic
```

## Shortcut Keyboard

| Tombol | Fungsi |
|--------|--------|
| `F2`   | Fokus ke pencarian produk |
| `Esc`  | Tutup modal |
