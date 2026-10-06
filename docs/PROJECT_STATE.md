# PROJECT_STATE: WO Vendor Portal (White-Label)

Sumber kebenaran tunggal untuk estafet antar akun. Perbarui file ini setiap akhir sesi atau sebelum kuota habis.

Terakhir diperbarui: 2026-10-06

---

## 1. Ringkasan Proyek

Portal web mobile-first untuk Vendor Mitra (kalender booking multi-slot, pembayaran, blokir tanggal, kuitansi) dan Owner WO (kalender gabungan, availability checker, harga modal, paket & penawaran white-label). Target biaya Rp0.

Acuan spesifikasi lengkap: `PRD_Aplikasi_WO_v2.md`.

## 2. Keputusan Teknis (Terkunci)

- Front-end modular: `index.html` hanya shell; logika di ES module `js/`. Tanpa `onclick` inline; event dipasang lewat `addEventListener`.
- Backend: Firebase Auth + Cloud Firestore via CDN (SDK 10.14.1, versi dikunci di `js/firebase.js`; modul lain impor dari `./firebase.js`).
- Wajib dijalankan lewat http (GitHub Pages / Live Server), bukan `file://`.
- `vendorId` = UID akun Firebase (diwajibkan oleh `firestore.rules`).
- Kuitansi dan penawaran: teks terformat lewat `wa.me` (tombol membuka WhatsApp dengan teks terisi; tanpa WhatsApp Business API, tanpa PDF).
- Pengguna tidak memakai Node/npm; instruksi setup harus terpandu.
- Akun owner dibuat manual: daftar di Authentication, lalu buat dokumen `users/{uid}` dengan `role: "owner"` di Console.
- Daftar per bulan milik vendor diambil dengan satu query `vendorId` lalu disaring di klien (tanpa composite index). Query owner memakai satu field (`tanggal`) saja.
- Nama merek WO untuk penawaran disimpan di `localStorage` browser owner (kunci `wo_brand_name`, default "Wedding Organizer"), diisi di tab Paket.

## 3. Peran & Alur Akun

| Peran | Akses |
|---|---|
| `owner` | Ringkasan slot (`slot_publik`, `blok_tanggal`), harga modal, paket, klien WO, persetujuan vendor |
| `vendor` | Hanya data miliknya (wajib `vendors.status == "aktif"` untuk masuk beranda) |
| `vendor_pending` | Hanya halaman status |

Registrasi: Auth user, lalu `users` (role `vendor_pending`), lalu `vendors` (status `menunggu`), lalu batch `aset` + `kategori`. Persetujuan owner mengubah `users.role` ke `vendor` dan `vendors.status` ke `aktif` dalam satu batch.

## 4. Koleksi Firestore & Konvensi Data

Koleksi: `users`, `vendors`, `vendors/{id}/aset`, `vendor_rahasia` (owner saja), `bookings`, `bookings/{id}/pembayaran`, `slot_publik`, `blok_tanggal`, `paket`, `paket/{id}/item`, `klien_wo`. Detail field di PRD v2 bagian 4.

Konvensi yang berlaku di kode:
- `vendors.kodeVendor` = 5 huruf pertama UID, huruf besar. `vendors.kuitansiTerakhir` = penghitung nomor kuitansi.
- ID dokumen `vendors/{id}/aset/{asetId}` = id kategori (mis. `tenda`), satu aset per kategori per vendor.
- `dayKey(vendorId, scope, tanggal)` = `${vendorId}_${scope}_${tanggal}`; ID dokumen `slot_publik` (scope = asetId) dan `blok_tanggal` (scope = asetId atau `"semua"`).
- `slot_publik`: `{ vendorId, asetId, tanggal, terisi }`.
- `blok_tanggal.slotDitutup`: `"semua"` = tutup total; angka = jumlah slot yang ditutup (kapasitas efektif = kapasitas dikurangi angka itu). Revisi dari PRD v2.
- Booking baru: `sumber: "mandiri"`, `statusBayar: "belum_bayar"`, `totalTagihan: 0` bila kosong, `slotKe = terisi + 1` (hanya informasi).
- `bookings.totalDibayar` = akumulasi pembayaran; `statusBayar` dihitung ulang tiap pembayaran atau perubahan total.
- Pembayaran: `jenis` otomatis (`pelunasan` jika menutup tagihan, selain itu `dp`); ditolak bila total tagihan 0 atau nominal melebihi sisa. Nomor kuitansi `KW-<kodeVendor>-<tahun>-<0001>`.
- `vendor_rahasia/{vendorId}`: `{ hargaModal: { <asetId>: angka } }`.
- `paket`: `{ namaPaket, tanggalAcara, klienWoId, status (draft|ditawarkan|deal|batal), totalModal, hargaJual, margin }`; `paket/{id}/item`: `{ vendorId, asetId, hargaModal, hargaJualItem }` (hargaModal adalah salinan saat item ditambahkan). `klien_wo`: `{ nama, noWa, catatan }`.
- Membuat blokir pada aset+tanggal yang sama menimpa blokir lama.
- `firestore.rules` yang berlaku sudah ditambal (`resource == null` pada baca `slot_publik` dan `blok_tanggal`).

## 5. Aturan Bisnis Kunci

- Kapasitas maks 3 acara per aset per hari (`MAX_SLOT`); booking memakai transaksi Firestore agar tidak double-booking.
- Tanggal terblokir tidak bisa dibooking; blokir tidak membatalkan booking yang sudah ada.
- Owner tidak membaca `bookings` mandiri vendor (nama klien tersembunyi), hanya `slot_publik`.
- Teks penawaran untuk klien hanya memuat merek WO, nama paket, kategori, dan harga jual; tanpa nama vendor dan tanpa harga modal.
- Status paket `deal` hanya mengubah status; belum mengunci slot vendor.

## 6. Struktur Berkas

```
index.html
firestore.rules
css/style.css                      token, komponen dasar, gaya kalender
js/app.js                          entry point
js/auth.js                         login, logout, registerVendor, onSession, refreshSession, loadProfile, authMessage
js/router.js                       initRouter, route, navigate (view lazy via import())
js/firebase.js                     init + re-export Auth/Firestore
js/constants.js                    MAX_SLOT, CATEGORIES, PAYMENT_STATUS
js/lib/availability.js             freeSlots(capacity, filled, blocks)
js/lib/receipt.js                  buildReceiptText, whatsappLink, receiptNumber, normalizePhone, formatRupiah, formatTanggal
js/lib/costing.js                  summarize(items), applyMarkup(hargaModal, persen)
js/lib/proposal.js                 buildProposalText, proposalLink
js/services/vendors.js             listVendorsByStatus, approveVendor, rejectVendor, deactivateVendor
js/services/assets.js              listAssets, saveAsset
js/services/bookings.js            createBooking, cancelBooking, listBookingsByMonth, listSlotsByMonth, bookingMessage, dayKey
js/services/blocks.js              listBlocksByMonth, addBlock, removeBlock, ALL_ASSETS
js/services/payments.js            addPayment, updateTotalTagihan, listPayments, paymentStatus, paymentMessage, todayKey
js/services/availability.js        loadActiveVendors, findAvailable, loadMonthOverview
js/services/costs.js               getCosts, loadAllCosts, setCost
js/services/packages.js            listClients, saveClient, listPackages, createPackage, getPackage, savePackageItems, setPackageStatus, PACKAGE_STATUS
js/views/login.js, register.js, status.js
js/views/vendor.js                 kalender + panel hari + form blokir
js/views/vendor/calendar.js        renderCalendar -> { reload }
js/views/vendor/dayPanel.js        renderDayPanel(container, { vendorId, namaVendor, aset, tanggal, details, onChanged })
js/views/vendor/blockForm.js       renderBlockForm
js/views/vendor/paymentForm.js     renderPaymentForm(container, { booking, namaVendor })
js/views/owner.js                  tab: Kalender, Cek, Paket, Harga, Vendor
js/views/owner/overview.js         renderOverview(container)
js/views/owner/checker.js          renderChecker(container, { onPick, tanggal })
js/views/owner/approvals.js        renderApprovals(container)
js/views/owner/costs.js            renderCosts(container)
js/views/owner/package.js          renderPackages(container)
js/views/owner/packageBuilder.js   renderPackageBuilder(container, { packageId, merek, onBack })
```

Kontrak view: `export function render(root, { profile, navigate })`. `profile` = `{ uid, email, role, vendorId, vendor }`.

## 7. Status Pengerjaan

| Tahap | Status |
|---|---|
| PRD v2 | Selesai |
| 1. Fondasi | Selesai |
| 2. Vendor: kalender, booking (transaksi), blokir tanggal | Selesai (belum diuji pengguna) |
| 3. Pembayaran & kuitansi WhatsApp | Selesai (belum diuji pengguna) |
| 4. Owner: persetujuan, kalender gabungan, availability checker | Selesai (belum diuji pengguna) |
| 5. Harga modal, paket, penawaran white-label | Selesai (belum diuji pengguna) |
| 6. Uji coba & peluncuran terbatas | Berikutnya |

Belum diuji end-to-end oleh pengguna (menunggu `firebaseConfig` terisi dan rules ditambal dipublish).

## 8. Tahap 6: Daftar Uji Manual

Persiapan: isi `firebaseConfig`; aktifkan Auth Email/Password dan Firestore; publish `firestore.rules`; buat akun owner manual; deploy ke GitHub Pages / Live Server.

Alur fungsional:
1. Daftar vendor (dengan beberapa aset) → muncul di tab Vendor owner → Setujui → login ulang vendor, beranda terbuka.
2. Vendor: booking pada tanggal kosong → warna kalender berubah; booking sampai kapasitas penuh → booking berikutnya ditolak; batalkan booking → slot kembali.
3. Vendor: tutup tanggal penuh dan sebagian → warna dan kuota berubah; booking ke tanggal tertutup ditolak.
4. Vendor: isi total tagihan → catat DP → Kirim Kuitansi (WhatsApp terbuka, teks benar) → catat pelunasan → status Lunas; nominal melebihi sisa ditolak.
5. Owner: Kalender gabungan dan tab Cek mencerminkan data vendor; vendor penuh/ditutup tidak muncul di hasil Cek.
6. Owner: isi harga modal → buat paket → Pilih item → Terapkan Markup → Simpan → Kirim Penawaran (cek tanpa nama vendor dan tanpa harga modal).

Uji hak akses (wajib):
- Vendor A tidak bisa membaca booking/pembayaran/blokir vendor B (coba lewat konsol browser).
- Vendor tidak bisa membaca `vendor_rahasia`, `paket`, `klien_wo`.
- Owner tidak bisa membaca `bookings` mandiri vendor.
- Pengguna `vendor_pending` tidak bisa membuat booking.
- Pengguna tidak bisa mengubah `users.role` sendiri.
- Dua tab/vendor membooking slot terakhir bersamaan: hanya satu yang berhasil.

## 9. Catatan & Risiko Terbuka

- Penyimpanan `aset` yang gagal saat registrasi hanya masuk konsol; belum ada halaman profil untuk melengkapinya (`saveAsset` sudah tersedia).
- Helper `el()` terduplikasi di banyak view; logika grid bulan terduplikasi di `calendar.js` dan `overview.js`. Rencana refactor ke `js/lib/dom.js` dan `js/lib/month.js`.
- Panel hari di `vendor.js` dimuat ulang dengan klik ulang pada sel tanggal terpilih; badge status bayar di kartu booking diperbarui saat panel dimuat ulang (ringkasan di bagian Pembayaran selalu terkini).
- Lima tab owner bisa terasa rapat di layar sempit.
- Paket `deal` belum mengunci slot vendor (rules sudah mengizinkan owner membuat booking `sumber: "wo"`; butuh `createWoBooking` dengan transaksi serupa `createBooking`).
- Hasil availability checker belum menampilkan kontak vendor.
- Nama merek tersimpan per browser owner.
- Kategori aset final belum dikonfirmasi (default di `js/constants.js`).
- Kesepakatan komisi dan aturan kontak langsung vendor ke klien di luar aplikasi.
- Rules belum diuji dengan Emulator.

## 10. Aturan Kerja dengan Pengguna

- Satu file per pesan, dikirim sebagai file unduhan, bukan teks kode di chat.
- Berhenti setelah satu file, tunggu "Lanjut".
- Kode ringkas, modular, tanpa komentar penjelas.
- Minim basa-basi.
- Ingatkan ekspor `PROJECT_STATE.md` terbaru sebelum kuota habis.
