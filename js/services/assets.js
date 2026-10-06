import { db, doc, collection, getDocs, setDoc } from "../firebase.js";
import { MAX_SLOT } from "../constants.js";

export async function listAssets(vendorId) {
  const snap = await getDocs(collection(db, "vendors", vendorId, "aset"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveAsset(vendorId, { id, spesifikasi = "", kapasitasPerHari }) {
  const capacity = Number(kapasitasPerHari);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_SLOT) {
    throw new Error("Kapasitas harus antara 1 dan " + MAX_SLOT + ".");
  }
  await setDoc(doc(db, "vendors", vendorId, "aset", id), {
    kategori: id,
    spesifikasi: spesifikasi.trim(),
    kapasitasPerHari: capacity
  });
}
