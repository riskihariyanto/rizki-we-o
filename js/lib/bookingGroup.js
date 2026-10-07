import { CATEGORIES } from "../constants.js";
import { normalizePhone } from "./receipt.js";

const ORDER = Object.fromEntries(CATEGORIES.map((c, index) => [c.id, index]));

export function statusOf(paid, total) {
  if (paid <= 0) return "belum_bayar";
  return paid >= total ? "lunas" : "dp";
}

export function groupKey(booking) {
  const name = String(booking.namaKlien || "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${booking.tanggalAcara}|${normalizePhone(booking.noWaKlien || "")}|${name}`;
}

function firstFilled(items, field) {
  const hit = items.find((item) => String(item[field] || "").trim());
  return hit ? hit[field] : "";
}

function compareItems(a, b) {
  const left = ORDER[a.asetId] ?? Number.MAX_SAFE_INTEGER;
  const right = ORDER[b.asetId] ?? Number.MAX_SAFE_INTEGER;
  return left - right || String(a.asetId).localeCompare(String(b.asetId));
}

function buildGroup(key, items) {
  const sorted = [...items].sort(compareItems);
  const totalTagihan = sorted.reduce((sum, item) => sum + (Number(item.totalTagihan) || 0), 0);
  const totalDibayar = sorted.reduce((sum, item) => sum + (Number(item.totalDibayar) || 0), 0);

  return {
    key,
    id: sorted[0].id,
    vendorId: sorted[0].vendorId,
    tanggalAcara: sorted[0].tanggalAcara,
    namaKlien: sorted[0].namaKlien,
    noWaKlien: firstFilled(sorted, "noWaKlien"),
    jamAcara: firstFilled(sorted, "jamAcara"),
    lokasi: firstFilled(sorted, "lokasi"),
    catatan: firstFilled(sorted, "catatan"),
    items: sorted,
    totalTagihan,
    totalDibayar,
    statusBayar: statusOf(totalDibayar, totalTagihan)
  };
}

export function groupBookings(list) {
  const buckets = new Map();

  list.forEach((booking) => {
    const key = groupKey(booking);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(booking);
  });

  return Array.from(buckets, ([key, items]) => buildGroup(key, items));
}
