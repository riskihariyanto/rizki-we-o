import {
  db,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp
} from "../firebase.js";
import { summarize } from "../lib/costing.js";

export const PACKAGE_STATUS = {
  draft: "Draft",
  ditawarkan: "Ditawarkan",
  deal: "Deal",
  batal: "Batal"
};

export async function listClients() {
  const snap = await getDocs(collection(db, "klien_wo"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.nama.localeCompare(b.nama));
}

export async function saveClient({ id, nama, noWa, catatan = "" }) {
  const ref = id ? doc(db, "klien_wo", id) : doc(collection(db, "klien_wo"));
  await setDoc(ref, { nama: nama.trim(), noWa: noWa.trim(), catatan: catatan.trim() }, { merge: true });
  return ref.id;
}

export async function listPackages() {
  const snap = await getDocs(collection(db, "paket"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.tanggalAcara).localeCompare(String(a.tanggalAcara)));
}

export async function createPackage({ namaPaket, tanggalAcara, klienWoId }) {
  const ref = doc(collection(db, "paket"));
  await setDoc(ref, {
    namaPaket: namaPaket.trim(),
    tanggalAcara,
    klienWoId,
    status: "draft",
    totalModal: 0,
    hargaJual: 0,
    margin: 0,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function getPackage(packageId) {
  const [packageSnap, itemSnap] = await Promise.all([
    getDoc(doc(db, "paket", packageId)),
    getDocs(collection(db, "paket", packageId, "item"))
  ]);
  if (!packageSnap.exists()) return null;
  return {
    id: packageSnap.id,
    ...packageSnap.data(),
    items: itemSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  };
}

export async function savePackageItems(packageId, items) {
  const itemsRef = collection(db, "paket", packageId, "item");
  const existing = await getDocs(itemsRef);
  const { totalModal, hargaJual, margin } = summarize(items);
  const batch = writeBatch(db);

  existing.docs.forEach((d) => batch.delete(d.ref));
  items.forEach((item) => {
    batch.set(doc(itemsRef), {
      vendorId: item.vendorId,
      asetId: item.asetId,
      hargaModal: Number(item.hargaModal) || 0,
      hargaJualItem: Number(item.hargaJualItem) || 0
    });
  });
  batch.update(doc(db, "paket", packageId), { totalModal, hargaJual, margin });

  await batch.commit();
}

export async function setPackageStatus(packageId, status) {
  await updateDoc(doc(db, "paket", packageId), { status });
}
