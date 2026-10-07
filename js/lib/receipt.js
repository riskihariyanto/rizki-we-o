import { CATEGORIES } from "../constants.js";

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const JENIS = { dp: "DP", pelunasan: "Pelunasan" };

const rupiah = new Intl.NumberFormat("id-ID");
const dateLong = new Intl.DateTimeFormat("id-ID", { dateStyle: "long" });

export function formatRupiah(value) {
  return "Rp " + rupiah.format(Number(value) || 0);
}

export function formatTanggal(tanggal) {
  const [y, m, d] = tanggal.split("-").map(Number);
  return dateLong.format(new Date(y, m - 1, d));
}

export function layananLabel(asetIds) {
  const ids = Array.isArray(asetIds) ? asetIds : [asetIds];
  return ids.filter(Boolean).map((id) => LABEL[id] || id).join(", ");
}

export function receiptNumber(kodeVendor, year, sequence) {
  return `KW-${kodeVendor}-${year}-${String(sequence).padStart(4, "0")}`;
}

export function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  return "62" + digits;
}

export function buildReceiptText(data) {
  const remaining = Math.max(0, data.totalTagihan - data.totalDibayar);
  const status = remaining === 0 ? "LUNAS" : "Belum lunas";

  return [
    "*KUITANSI PEMBAYARAN*",
    `No: ${data.nomorKuitansi}`,
    "",
    `Vendor: ${data.namaVendor}`,
    `Klien: ${data.namaKlien}`,
    `Layanan: ${layananLabel(data.asetIds || data.asetId)}`,
    `Tanggal acara: ${formatTanggal(data.tanggalAcara)}`,
    "",
    `Pembayaran: ${JENIS[data.jenis] || data.jenis}`,
    `Jumlah: ${formatRupiah(data.nominal)}`,
    `Tanggal bayar: ${formatTanggal(data.tanggalBayar)}`,
    "",
    `Total tagihan: ${formatRupiah(data.totalTagihan)}`,
    `Total dibayar: ${formatRupiah(data.totalDibayar)}`,
    `Sisa: ${formatRupiah(remaining)}`,
    `Status: ${status}`,
    "",
    "Terima kasih atas kepercayaan Anda."
  ].join("\n");
}

export function whatsappLink(phone, text) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
}
