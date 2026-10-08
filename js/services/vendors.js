import {
  db,
  doc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  updateDoc
} from "../firebase.js";

export async function listVendorsByStatus(status) {
  const snap = await getDocs(query(collection(db, "vendors"), where("status", "==", status)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function approveVendor(vendorId) {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", vendorId), { role: "vendor" });
  batch.update(doc(db, "vendors", vendorId), { status: "aktif" });
  await batch.commit();
}

export async function rejectVendor(vendorId) {
  await updateDoc(doc(db, "vendors", vendorId), { status: "ditolak" });
}

export async function deactivateVendor(vendorId) {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", vendorId), { role: "vendor_pending" });
  batch.update(doc(db, "vendors", vendorId), { status: "nonaktif" });
  await batch.commit();
}
