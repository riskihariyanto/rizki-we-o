import {
  db,
  doc,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "../firebase.js";
import { dayKey } from "./bookings.js";
import { MAX_SLOT } from "../constants.js";

export const ALL_ASSETS = "semua";

export async function listBlocksByMonth(vendorId, month) {
  const snap = await getDocs(query(collection(db, "blok_tanggal"), where("vendorId", "==", vendorId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((block) => typeof block.tanggal === "string" && block.tanggal.startsWith(month));
}

function normalizeSlots(value) {
  if (value === "semua") return "semua";
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_SLOT) {
    throw new Error("Jumlah slot harus antara 1 dan " + MAX_SLOT + ".");
  }
  return count;
}

export async function addBlock({ vendorId, asetId = ALL_ASSETS, tanggal, slotDitutup = "semua", alasan = "" }) {
  const id = dayKey(vendorId, asetId, tanggal);
  await setDoc(doc(db, "blok_tanggal", id), {
    vendorId,
    asetId,
    tanggal,
    slotDitutup: normalizeSlots(slotDitutup),
    alasan: alasan.trim(),
    createdAt: serverTimestamp()
  });
  return id;
}

export async function removeBlock(blockId) {
  await deleteDoc(doc(db, "blok_tanggal", blockId));
}
