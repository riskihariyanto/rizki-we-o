# PRD v2: WO Vendor Portal (White-Label)

Revisi dari PRD_Aplikasi_WO_Modal_0.md. Perubahan utama: stack ke Firebase + single-file HTML, harga modal diisolasi, tabel pembayaran ditambahkan, slot per aset, alur persetujuan vendor, kuitansi via wa.me.

---

## 1. Ringkasan

Portal web mobile-first untuk dua pihak:

1. **Vendor Mitra** mengelola kalender booking, pembayaran, hari libur, dan kuitansi secara gratis.
2. **Owner WO** memantau ketersediaan seluruh vendor secara real-time, meracik paket gabungan, dan menjual di bawah merek WO sendiri dengan harga markup.

Target biaya: Rp0 (Firebase paket Spark, hosting statis GitHub Pages / Firebase Hosting).

## 2. Stack

| Lapisan | Pilihan |
|---|---|
| Front-end | Satu file `index.html` (vanilla JS), opsi migrasi ke React + Vite |
| Auth | Firebase Authentication (email + password) |
| Database | Cloud Firestore |
| Keamanan | Firestore Security Rules per peran |
| Kuitansi | Teks terformat dikirim lewat tautan `wa.me` (tanpa WhatsApp Business API) |
| Hosting | GitHub Pages atau Firebase Hosting |

Catatan: `wa.me` hanya mengirim teks. Lampiran PDF tidak didukung pada skema Rp0.

## 3. Peran & Hak Akses

| Peran | Hak |
|---|---|
| `owner` | Baca semua vendor, status slot, harga modal, paket, klien WO. Setujui/tolak vendor. |
| `vendor` | Baca/tulis hanya data miliknya (profil, booking, libur, pembayaran). Tidak bisa melihat vendor lain. |
| `vendor_pending` | Sudah registrasi, belum disetujui. Hanya bisa melihat halaman status. |

Klien tidak punya akun. Klien hanya menerima dokumen/penawaran bermerek WO.

## 4. Model Data (Firestore)

### `users/{uid}`
- `role` (owner | vendor | vendor_pending)
- `vendorId`
- `createdAt`

### `vendors/{vendorId}`
- `namaVendor`, `noWa`, `alamat`
- `status` (menunggu | aktif | ditolak | nonaktif)
- `kategori[]` (tenda, sound, mua, dokumentasi, katering, dll.)
- `createdAt`

### `vendors/{vendorId}/aset/{asetId}`
- `kategori`
- `spesifikasi`
- `kapasitasPerHari` (angka, default 1, maks 3)

Kapasitas ditetapkan per aset, bukan per vendor.

### `vendor_rahasia/{vendorId}` (hanya owner)
- `hargaModal` per kategori/aset: `{ asetId, hargaModal }`
- `catatanOwner`

Harga modal sengaja dipisah dari dokumen vendor agar tidak pernah terbaca oleh peran `vendor`.

### `bookings/{bookingId}`
- `vendorId`, `asetId`
- `tanggalAcara` (YYYY-MM-DD)
- `slotKe` (1..kapasitasPerHari)
- `sumber` (mandiri | wo)
- `namaKlien`, `noWaKlien` (hanya terlihat vendor pemilik)
- `catatan`
- `statusBayar` (belum_bayar | dp | lunas)
- `totalTagihan`, `createdAt`

Owner hanya membaca ringkasan slot (vendorId, asetId, tanggal, slotKe, sumber). Nama klien order mandiri vendor disembunyikan dari owner. Implementasi: koleksi `slot_publik/{vendorId_asetId_tanggal}` berisi jumlah terisi, ditulis bersamaan dengan booking.

### `bookings/{bookingId}/pembayaran/{payId}`
- `jenis` (dp | pelunasan)
- `nominal`
- `tanggalBayar`
- `metode` (tunai | transfer)
- `nomorKuitansi`

### `blok_tanggal/{id}`
- `vendorId`, `asetId` (kosong = semua aset)
- `tanggal`
- `slotDitutup` (semua | angka slot)
- `alasan`

### `paket/{paketId}` (hanya owner)
- `namaPaket`, `tanggalAcara`, `klienWoId`
- `hargaJual`, `totalModal`, `margin`
- `status` (draft | ditawarkan | deal | batal)

### `paket/{paketId}/item/{itemId}`
- `vendorId`, `asetId`
- `hargaModal`, `hargaJualItem`

### `klien_wo/{klienId}` (hanya owner)
- `nama`, `noWa`, `catatan`

## 5. Fitur

### 5.1 Vendor
1. **Registrasi:** nama, WA, alamat, ceklis aset, spesifikasi, kapasitas per aset. Akun masuk status `menunggu` sampai disetujui owner.
2. **Kalender bulanan:** navigasi bulan tanpa batas. Tiap tanggal menampilkan indikator kuota (0/3, 1/3, Full) per aset. Tanggal terblokir ditandai silang.
3. **Booking:** pilih tanggal, aset, slot. Sistem menolak jika kapasitas aset penuh atau tanggal diblokir. Validasi dilakukan dengan transaksi Firestore untuk mencegah double-booking.
4. **Pembayaran:** catat DP dan pelunasan lengkap dengan nominal dan tanggal. Status bayar dihitung otomatis dari total pembayaran terhadap `totalTagihan`.
5. **Kuitansi:** dibuat otomatis tiap pembayaran dicatat, bernomor urut per vendor. Tombol "Kirim Kuitansi" membuka `wa.me/<noWaKlien>?text=<teks kuitansi>`.
6. **Block Date:** blokir sehari penuh atau slot tertentu, per aset atau semua aset, dengan alasan.

### 5.2 Owner WO
1. **Persetujuan vendor:** daftar vendor `menunggu`, tombol setuju/tolak.
2. **Kalender gabungan:** ringkasan okupansi semua vendor per bulan (tanpa nama klien vendor).
3. **Availability Checker:** input tanggal + kategori aset, hasil daftar vendor/aset yang masih punya slot kosong dan tidak diblokir.
4. **Costing & Bundling:** pilih beberapa vendor dari hasil checker, harga modal muncul otomatis, owner mengisi harga jual per item atau total. Tampil total modal, harga jual, margin (Rp dan %).
5. **White-label:** dokumen penawaran untuk klien hanya memuat merek WO, nama paket, dan item generik (contoh "Dekorasi & Tenda"), tanpa nama vendor.
6. **Pencatatan klien WO:** simpan klien dan paket yang ditawarkan.

## 6. Aturan Keamanan (ringkas)

- `vendor_rahasia`, `paket`, `klien_wo`: baca/tulis hanya `owner`.
- `vendors`, `bookings`, `blok_tanggal`: vendor hanya dokumen dengan `vendorId` miliknya; owner baca ringkasan lewat `slot_publik`.
- `users.role` hanya bisa diubah oleh owner (lewat konsol atau fungsi admin), tidak oleh klien.
- Registrasi tidak boleh langsung memberi role `vendor`.

## 7. Aturan Bisnis

- Kapasitas maksimum per aset per hari: 3 acara.
- Tanggal terblokir tidak bisa dibooking oleh vendor maupun owner.
- Status bayar: `belum_bayar` jika total bayar 0, `dp` jika 0 < total < tagihan, `lunas` jika total >= tagihan.
- Nomor kuitansi format `KW-<kodeVendor>-<tahun>-<urut>`.
- Kesepakatan komisi dan aturan kontak langsung vendor ke klien WO ditetapkan di luar aplikasi (perjanjian tertulis dengan vendor).

## 8. Di Luar Cakupan (v2)

- Pengiriman WhatsApp otomatis tanpa tindakan pengguna (butuh WhatsApp Business API berbayar).
- Lampiran PDF kuitansi lewat WhatsApp.
- Pembayaran online / payment gateway.
- Akun klien.

## 9. Tahap Pengerjaan

1. **Fondasi:** proyek Firebase, Auth, Firestore, aturan keamanan, kerangka `index.html`.
2. **Vendor:** registrasi, kalender, booking, blok tanggal.
3. **Pembayaran & kuitansi:** tabel pembayaran, generator teks kuitansi, tautan `wa.me`.
4. **Owner:** persetujuan vendor, kalender gabungan, availability checker.
5. **Costing & paket:** kalkulator markup, dokumen penawaran white-label.
6. **Uji coba:** simulasi lintas bulan, uji double-booking, uji hak akses, peluncuran terbatas ke beberapa vendor.

## 10. Kriteria Selesai

- Dua booking bersamaan pada slot terakhir tidak pernah sama-sama berhasil.
- Akun vendor tidak dapat membaca `vendor_rahasia`, vendor lain, atau paket owner (diuji manual).
- Dokumen penawaran klien tidak memuat nama vendor.
- Kuitansi terbuka di WhatsApp dengan teks terisi lengkap dalam dua ketukan.
