import {
  db,
  doc,
  collection,
  getDocs,
  runTransaction,
  serverTimestamp
} from "../firebase.js";
import { receiptNumber } from "../lib/receipt.js";

const ERROR_TEXT = {
  NOMINAL_TIDAK_VALID: "Nominal pembayaran harus lebih dari nol.",
  TAGIHAN_KOSONG: "Isi total tagihan terlebih dahulu.",
  MELEBIHI_TAGIHAN: "Nominal melebihi sisa tagihan.",
  TAGIHAN_DI_BAWAH_BAYAR: "Total tagihan tidak boleh lebih kecil dari yang sudah dibayar.",
  BOOKING_TIDAK_ADA: "Booking tidak ditemukan.",
  "permission-denied": "Akses ditolak oleh aturan keamanan."
};

export function paymentMessage(err) {
  return ERROR_TEXT[err && (err.code || err.message)] || "Gagal memproses pembayaran. Coba lagi.";
}

export function paymentStatus(paid, total) {
  if (paid <= 0) return "belum_bayar";
  return paid >= total ? "lunas" : "dp";
}

export function todayKey() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export async function listPayments(bookingId) {
  const snap = await getDocs(collection(db, "bookings", bookingId, "pembayaran"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.nomorKuitansi.localeCompare(b.nomorKuitansi));
}

export async function addPayment({ bookingId, vendorId, nominal, metode = "tunai", tanggalBayar = todayKey() }) {
  const amount = Number(nominal);
  const bookingRef = doc(db, "bookings", bookingId);
  const vendorRef = doc(db, "vendors", vendorId);
  const paymentRef = doc(collection(db, "bookings", bookingId, "pembayaran"));

  return runTransaction(db, async (tx) => {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("NOMINAL_TIDAK_VALID");

    const bookingSnap = await tx.get(bookingRef);
    const vendorSnap = await tx.get(vendorRef);
    if (!bookingSnap.exists()) throw new Error("BOOKING_TIDAK_ADA");

    const booking = bookingSnap.data();
    const vendor = vendorSnap.data();
    const total = Number(booking.totalTagihan) || 0;
    const paid = Number(booking.totalDibayar) || 0;
    const newPaid = paid + amount;

    if (total <= 0) throw new Error("TAGIHAN_KOSONG");
    if (newPaid > total) throw new Error("MELEBIHI_TAGIHAN");

    const sequence = (Number(vendor.kuitansiTerakhir) || 0) + 1;
    const nomorKuitansi = receiptNumber(vendor.kodeVendor, tanggalBayar.slice(0, 4), sequence);
    const jenis = newPaid >= total ? "pelunasan" : "dp";

    tx.set(paymentRef, { jenis, nominal: amount, tanggalBayar, metode, nomorKuitansi, createdAt: serverTimestamp() });
    tx.update(bookingRef, { totalDibayar: newPaid, statusBayar: paymentStatus(newPaid, total) });
    tx.update(vendorRef, { kuitansiTerakhir: sequence });

    return {
      id: paymentRef.id,
      jenis,
      nominal: amount,
      tanggalBayar,
      metode,
      nomorKuitansi,
      totalDibayar: newPaid,
      totalTagihan: total,
      namaVendor: vendor.namaVendor,
      booking
    };
  });
}

export async function updateTotalTagihan(bookingId, total) {
  const value = Number(total);
  const bookingRef = doc(db, "bookings", bookingId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) throw new Error("BOOKING_TIDAK_ADA");

    const paid = Number(snap.data().totalDibayar) || 0;
    if (!Number.isFinite(value) || value < paid) throw new Error("TAGIHAN_DI_BAWAH_BAYAR");

    tx.update(bookingRef, { totalTagihan: value, statusBayar: paymentStatus(paid, value) });
  });
}

export async function listGroupPayments(bookingIds) {
  const lists = await Promise.all(bookingIds.map((id) => listPayments(id)));
  const merged = new Map();

  lists.flat().forEach((payment) => {
    const current = merged.get(payment.nomorKuitansi);
    if (current) {
      current.nominal += Number(payment.nominal) || 0;
      return;
    }
    merged.set(payment.nomorKuitansi, { ...payment, id: payment.nomorKuitansi, nominal: Number(payment.nominal) || 0 });
  });

  return Array.from(merged.values()).sort((a, b) => a.nomorKuitansi.localeCompare(b.nomorKuitansi));
}

export async function addGroupPayment({ bookingIds, vendorId, nominal, metode = "tunai", tanggalBayar = todayKey() }) {
  const amount = Number(nominal);
  const vendorRef = doc(db, "vendors", vendorId);
  const bookingRefs = bookingIds.map((id) => doc(db, "bookings", id));
  const paymentRefs = bookingIds.map((id) => doc(collection(db, "bookings", id, "pembayaran")));

  return runTransaction(db, async (tx) => {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("NOMINAL_TIDAK_VALID");

    const vendorSnap = await tx.get(vendorRef);
    const bookingSnaps = await Promise.all(bookingRefs.map((ref) => tx.get(ref)));
    if (bookingSnaps.some((snap) => !snap.exists())) throw new Error("BOOKING_TIDAK_ADA");

    const rows = bookingSnaps.map((snap, index) => {
      const data = snap.data();
      return {
        index,
        total: Number(data.totalTagihan) || 0,
        paid: Number(data.totalDibayar) || 0
      };
    });

    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const paid = rows.reduce((sum, row) => sum + row.paid, 0);
    const newPaid = paid + amount;

    if (total <= 0) throw new Error("TAGIHAN_KOSONG");
    if (newPaid > total) throw new Error("MELEBIHI_TAGIHAN");

    const vendor = vendorSnap.data();
    const sequence = (Number(vendor.kuitansiTerakhir) || 0) + 1;
    const nomorKuitansi = receiptNumber(vendor.kodeVendor, tanggalBayar.slice(0, 4), sequence);
    const jenis = newPaid >= total ? "pelunasan" : "dp";

    let left = amount;
    rows.forEach((row) => {
      const share = Math.min(Math.max(0, row.total - row.paid), left);
      if (share <= 0) return;
      left -= share;
      const itemPaid = row.paid + share;

      tx.set(paymentRefs[row.index], {
        jenis,
        nominal: share,
        tanggalBayar,
        metode,
        nomorKuitansi,
        createdAt: serverTimestamp()
      });
      tx.update(bookingRefs[row.index], { totalDibayar: itemPaid, statusBayar: paymentStatus(itemPaid, row.total) });
    });

    tx.update(vendorRef, { kuitansiTerakhir: sequence });

    return {
      id: nomorKuitansi,
      jenis,
      nominal: amount,
      tanggalBayar,
      metode,
      nomorKuitansi,
      totalDibayar: newPaid,
      totalTagihan: total,
      namaVendor: vendor.namaVendor
    };
  });
}

export async function updateGroupTotals(entries) {
  const refs = entries.map((entry) => doc(db, "bookings", entry.id));

  await runTransaction(db, async (tx) => {
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

    snaps.forEach((snap, index) => {
      if (!snap.exists()) throw new Error("BOOKING_TIDAK_ADA");
      const value = Number(entries[index].total);
      const paid = Number(snap.data().totalDibayar) || 0;
      if (!Number.isFinite(value) || value < paid) throw new Error("TAGIHAN_DI_BAWAH_BAYAR");
    });

    snaps.forEach((snap, index) => {
      const value = Number(entries[index].total);
      const paid = Number(snap.data().totalDibayar) || 0;
      tx.update(refs[index], { totalTagihan: value, statusBayar: paymentStatus(paid, value) });
    });
  });
}
