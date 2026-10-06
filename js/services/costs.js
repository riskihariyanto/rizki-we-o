import { db, doc, collection, getDoc, getDocs, setDoc } from "../firebase.js";

export async function getCosts(vendorId) {
  const snap = await getDoc(doc(db, "vendor_rahasia", vendorId));
  return snap.exists() ? snap.data().hargaModal || {} : {};
}

export async function loadAllCosts() {
  const snap = await getDocs(collection(db, "vendor_rahasia"));
  return new Map(snap.docs.map((d) => [d.id, d.data().hargaModal || {}]));
}

export async function setCost(vendorId, asetId, price) {
  const value = Number(price);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Harga modal harus berupa angka nol atau lebih.");
  }
  await setDoc(doc(db, "vendor_rahasia", vendorId), { hargaModal: { [asetId]: value } }, { merge: true });
}
