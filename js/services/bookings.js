import {
  db,
  doc,
  collection,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp
} from "../firebase.js";

const ERROR_TEXT = {
  TANGGAL_DIBLOK: "Tanggal ini ditutup untuk aset tersebut.",
  SLOT_PENUH: "Kapasitas aset pada tanggal ini sudah penuh.",
  "permission-denied": "Akses ditolak oleh aturan keamanan."
};

export function bookingMessage(err) {
  return ERROR_TEXT[err && (err.code || err.message)] || "Gagal memproses booking. Coba lagi.";
}

export function dayKey(vendorId, scope, tanggal) {
  return `${vendorId}_${scope}_${tanggal}`;
}

function closedCount(blockSnaps, capacity) {
  let closed = 0;
  for (const snap of blockSnaps) {
    if (!snap.exists()) continue;
    const value = snap.data().slotDitutup;
    if (value === "semua") return capacity;
    closed += Number(value) || 0;
  }
  return Math.min(closed, capacity);
}

async function listOwn(collectionName, vendorId, field, month) {
  const snap = await getDocs(query(collection(db, collectionName), where("vendorId", "==", vendorId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((item) => typeof item[field] === "string" && item[field].startsWith(month));
}

export function listBookingsByMonth(vendorId, month) {
  return listOwn("bookings", vendorId, "tanggalAcara", month);
}

export function listSlotsByMonth(vendorId, month) {
  return listOwn("slot_publik", vendorId, "tanggal", month);
}

export async function createBooking(input) {
  const { vendorId, asetId, tanggalAcara, kapasitasPerHari } = input;
  const bookingRef = doc(collection(db, "bookings"));
  const slotRef = doc(db, "slot_publik", dayKey(vendorId, asetId, tanggalAcara));
  const blockRefs = [asetId, "semua"].map((scope) =>
    doc(db, "blok_tanggal", dayKey(vendorId, scope, tanggalAcara))
  );

  await runTransaction(db, async (tx) => {
    const slotSnap = await tx.get(slotRef);
    const blockSnaps = await Promise.all(blockRefs.map((ref) => tx.get(ref)));

    const terisi = slotSnap.exists() ? slotSnap.data().terisi : 0;
    const closed = closedCount(blockSnaps, kapasitasPerHari);

    if (closed >= kapasitasPerHari) throw new Error("TANGGAL_DIBLOK");
    if (terisi >= kapasitasPerHari - closed) throw new Error("SLOT_PENUH");

    tx.set(bookingRef, {
      vendorId,
      asetId,
      tanggalAcara,
      slotKe: terisi + 1,
      sumber: "mandiri",
      namaKlien: input.namaKlien.trim(),
      noWaKlien: input.noWaKlien.trim(),
      jamAcara: (input.jamAcara || "").trim(),
      lokasi: (input.lokasi || "").trim(),
      catatan: (input.catatan || "").trim(),
      statusBayar: "belum_bayar",
      totalTagihan: Number(input.totalTagihan) || 0,
      createdAt: serverTimestamp()
    });

    tx.set(slotRef, { vendorId, asetId, tanggal: tanggalAcara, terisi: terisi + 1 });
  });

  return bookingRef.id;
}

export async function cancelBooking(bookingId) {
  const bookingRef = doc(db, "bookings", bookingId);

  await runTransaction(db, async (tx) => {
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists()) return;

    const { vendorId, asetId, tanggalAcara } = bookingSnap.data();
    const slotRef = doc(db, "slot_publik", dayKey(vendorId, asetId, tanggalAcara));
    const slotSnap = await tx.get(slotRef);

    tx.delete(bookingRef);
    if (slotSnap.exists()) {
      tx.update(slotRef, { terisi: Math.max(0, slotSnap.data().terisi - 1) });
    }
  });
}