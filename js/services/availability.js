import { db, collection, getDocs, query, where } from "../firebase.js";
import { listVendorsByStatus } from "./vendors.js";
import { listAssets } from "./assets.js";
import { ALL_ASSETS } from "./blocks.js";
import { freeSlots } from "../lib/availability.js";

function mapDocs(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function loadActiveVendors() {
  const vendors = await listVendorsByStatus("aktif");
  return Promise.all(vendors.map(async (vendor) => ({ ...vendor, aset: await listAssets(vendor.id) })));
}

export async function findAvailable({ tanggal, kategori }) {
  const [vendors, slotSnap, blockSnap] = await Promise.all([
    loadActiveVendors(),
    getDocs(query(collection(db, "slot_publik"), where("tanggal", "==", tanggal))),
    getDocs(query(collection(db, "blok_tanggal"), where("tanggal", "==", tanggal)))
  ]);

  const slots = mapDocs(slotSnap);
  const blocks = mapDocs(blockSnap);
  const results = [];

  vendors.forEach((vendor) => {
    vendor.aset
      .filter((item) => item.kategori === kategori)
      .forEach((item) => {
        const slot = slots.find((s) => s.vendorId === vendor.id && s.asetId === item.id);
        const relevant = blocks.filter(
          (b) => b.vendorId === vendor.id && (b.asetId === item.id || b.asetId === ALL_ASSETS)
        );
        const { closed, free } = freeSlots(item.kapasitasPerHari, slot ? slot.terisi : 0, relevant);

        if (free > 0) {
          results.push({
            vendorId: vendor.id,
            namaVendor: vendor.namaVendor,
            wilayah: vendor.wilayah || "",
            asetId: item.id,
            spesifikasi: item.spesifikasi || "",
            capacity: item.kapasitasPerHari,
            closed,
            free
          });
        }
      });
  });

  return results.sort((a, b) => b.free - a.free || a.namaVendor.localeCompare(b.namaVendor));
}

export async function loadMonthOverview(month) {
  const range = [where("tanggal", ">=", `${month}-01`), where("tanggal", "<=", `${month}-31`)];

  const [vendors, slotSnap, blockSnap] = await Promise.all([
    loadActiveVendors(),
    getDocs(query(collection(db, "slot_publik"), ...range)),
    getDocs(query(collection(db, "blok_tanggal"), ...range))
  ]);

  return { vendors, slots: mapDocs(slotSnap), blocks: mapDocs(blockSnap) };
}