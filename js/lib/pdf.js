import { CATEGORIES } from "../constants.js";
import { formatRupiah, formatTanggal } from "./receipt.js";
import {
  loadPdf,
  terbilang,
  drawHeader,
  infoRow,
  ensureSpace,
  drawTable,
  drawTotal,
  drawFooter,
  COLOR,
  MARGIN,
  RIGHT
} from "./pdfkit.js";

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const JENIS = { dp: "DP", pelunasan: "Pelunasan" };
const METODE = { tunai: "Tunai", transfer: "Transfer" };
const ERROR_TEXT = {
  PDF_GAGAL_DIMUAT: "Perangkat PDF gagal dimuat. Periksa koneksi internet lalu coba lagi.",
  TAGIHAN_KOSONG: "Isi total tagihan terlebih dahulu sebelum membuat invoice."
};

const CONTENT_WIDTH = RIGHT - MARGIN;
const HINT = [148, 163, 184];

const BADGE = {
  lunas: { text: "LUNAS", fill: [220, 252, 231], edge: [22, 101, 52], ink: [22, 101, 52] },
  dp: { text: "DP", fill: [219, 234, 254], edge: [30, 64, 175], ink: [30, 64, 175] },
  belum: { text: "BELUM LUNAS", fill: [255, 237, 213], edge: [194, 65, 12], ink: [154, 52, 18] }
};

export function pdfMessage(err) {
  return ERROR_TEXT[err && err.message] || "Gagal membuat PDF. Coba lagi.";
}

export function invoiceNumber(kodeVendor, bookingId, tanggalAcara) {
  const tail = String(bookingId || "").slice(-4).toUpperCase().padStart(4, "0");
  return `INV-${kodeVendor || "WO"}-${String(tanggalAcara).replace(/-/g, "")}-${tail}`;
}

function vendorInfo(vendor = {}) {
  const alamat = [vendor.alamat, vendor.email && `Email: ${vendor.email}`].filter(Boolean).join("\n");
  return { nama: vendor.namaVendor || vendor.nama || "Vendor", alamat, noWa: vendor.noWa || "" };
}

function bankLine(vendor = {}) {
  if (!vendor.namaBank || !vendor.noRekening) return "";
  const owner = vendor.atasNama ? ` a.n ${vendor.atasNama}` : "";
  return `Informasi Rekening Bank: ${vendor.namaBank} - ${vendor.noRekening}${owner}`;
}

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function put(doc, text, x, y, { size = 10, bold = false, italic = false, color = COLOR.ink, align = "left" } = {}) {
  doc.setFont("helvetica", bold ? "bold" : italic ? "italic" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text, x, y, { align });
}

function safeName(text) {
  return String(text).replace(/[^A-Za-z0-9_-]+/g, "_");
}

async function createDocument() {
  const JsPdf = await loadPdf();
  return new JsPdf({ unit: "mm", format: "a4" });
}

function remainingOf(total, paid) {
  return Math.max(0, (Number(total) || 0) - (Number(paid) || 0));
}

function drawBadge(doc, kind) {
  const badge = BADGE[kind];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);

  const width = doc.getTextWidth(badge.text) + 10;
  const height = 6.8;
  const x = RIGHT - width;
  const y = 33;

  doc.setFillColor(...badge.fill);
  doc.setDrawColor(...badge.edge);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, width, height, 1.6, 1.6, "FD");

  doc.setTextColor(...badge.ink);
  doc.text(badge.text, x + width / 2, y + 4.7, { align: "center" });
}

function drawAmountBox(doc, y, label, amount) {
  const words = doc.splitTextToSize(`"${terbilang(amount)}"`, CONTENT_WIDTH - 12);
  const height = 26 + words.length * 5;

  doc.setFillColor(...COLOR.soft);
  doc.rect(MARGIN, y, CONTENT_WIDTH, height, "F");
  doc.setFillColor(...COLOR.ink);
  doc.rect(MARGIN, y, 1.6, height, "F");

  put(doc, label, MARGIN + 7, y + 8, { size: 9, color: COLOR.muted });
  put(doc, formatRupiah(amount), MARGIN + 7, y + 18, { size: 20, bold: true });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.muted);
  doc.text(words, MARGIN + 7, y + 25);

  return y + height;
}

function drawSignature(doc, y, namaVendor) {
  y = ensureSpace(doc, y, 58);
  const center = RIGHT - 32;
  const boxWidth = 58;
  const boxHeight = 28;
  const top = y + 3;
  const names = doc.splitTextToSize(namaVendor, 64);

  put(doc, "Hormat kami,", center, y, { align: "center" });

  doc.setDrawColor(...HINT);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.4, 1.2], 0);
  doc.roundedRect(center - boxWidth / 2, top, boxWidth, boxHeight, 1.5, 1.5, "S");
  doc.setLineDashPattern([], 0);

  put(doc, "Tanda tangan & cap", center, top + boxHeight - 3, { size: 7, color: HINT, align: "center" });
  put(doc, names, center, top + boxHeight + 7, { bold: true, align: "center" });

  return top + boxHeight + 7 + names.length * 5;
}

export async function buildReceiptPdf(data) {
  const doc = await createDocument();
  const vendor = vendorInfo(data.vendor);
  const layanan = LABEL[data.asetId] || data.asetId;
  const remaining = remainingOf(data.totalTagihan, data.totalDibayar);
  const lunas = remaining === 0;

  let y = drawHeader(doc, { title: "KUITANSI", number: data.nomorKuitansi, vendor });
  drawBadge(doc, lunas ? "lunas" : "dp");

  y = infoRow(doc, y, "Telah terima dari", data.namaKlien);
  y = infoRow(doc, y, "Untuk pembayaran", `${JENIS[data.jenis] || data.jenis} ${layanan}`);
  y = infoRow(doc, y, "Tanggal acara", formatTanggal(data.tanggalAcara));
  y = infoRow(doc, y, "Tanggal bayar", formatTanggal(data.tanggalBayar));
  y = infoRow(doc, y, "Metode", METODE[data.metode] || "Tunai");

  y = drawAmountBox(doc, y + 4, "Jumlah dibayar", data.nominal) + 12;

  y = drawTotal(doc, y, "Total tagihan", formatRupiah(data.totalTagihan));
  y = drawTotal(doc, y, "Total dibayar", formatRupiah(data.totalDibayar));
  doc.setDrawColor(...COLOR.line);
  doc.setLineWidth(0.2);
  doc.line(RIGHT - 62, y - 3.5, RIGHT, y - 3.5);
  y = drawTotal(doc, y + 1, "Sisa tagihan", formatRupiah(remaining), { bold: true });

  const signEnd = drawSignature(doc, y + 10, vendor.nama);

  put(doc, `Kuitansi ini sah sebagai bukti pembayaran yang diterbitkan oleh ${vendor.nama}.`, MARGIN, signEnd + 8, {
    size: 8,
    color: COLOR.muted
  });

  drawFooter(doc);
  return doc;
}

export async function downloadReceiptPdf(data) {
  const doc = await buildReceiptPdf(data);
  doc.save(`Kuitansi_${safeName(data.nomorKuitansi)}.pdf`);
}

export async function buildInvoicePdf(data) {
  const total = Number(data.totalTagihan) || 0;
  if (total <= 0) throw new Error("TAGIHAN_KOSONG");

  const doc = await createDocument();
  const vendor = vendorInfo(data.vendor);
  const layanan = LABEL[data.asetId] || data.asetId;
  const paid = Number(data.totalDibayar) || 0;
  const remaining = remainingOf(total, paid);
  const lunas = remaining === 0;
  const number = data.nomor || invoiceNumber(data.vendor && data.vendor.kodeVendor, data.bookingId, data.tanggalAcara);
  const payments = data.payments || [];

  let y = drawHeader(doc, { title: "INVOICE", number, vendor });
  drawBadge(doc, lunas ? "lunas" : paid > 0 ? "dp" : "belum");

  y = infoRow(doc, y, "Ditagihkan kepada", data.namaKlien);
  if (data.noWaKlien) y = infoRow(doc, y, "WhatsApp", data.noWaKlien);
  y = infoRow(doc, y, "Tanggal acara", formatTanggal(data.tanggalAcara));
  y = infoRow(doc, y, "Tanggal terbit", formatTanggal(data.tanggalTerbit || todayIso()));

  y = drawTable(
    doc,
    y + 4,
    [
      { title: "No", x: MARGIN + 3, width: 10 },
      { title: "Deskripsi", x: MARGIN + 16, width: 110 },
      { title: "Jumlah", x: RIGHT - 3, width: 36, align: "right" }
    ],
    [["1", `Jasa ${layanan} - acara ${formatTanggal(data.tanggalAcara)}`, formatRupiah(total)]]
  );

  y += 8;
  y = drawTotal(doc, y, "Total tagihan", formatRupiah(total));
  y = drawTotal(doc, y, "Total dibayar", formatRupiah(paid));
  doc.setDrawColor(...COLOR.line);
  doc.setLineWidth(0.2);
  doc.line(RIGHT - 62, y - 3.5, RIGHT, y - 3.5);
  y = drawTotal(doc, y + 1, "Sisa tagihan", formatRupiah(remaining), { bold: true });

  const words = doc.splitTextToSize(`Terbilang: ${terbilang(total)}`, CONTENT_WIDTH);
  y = ensureSpace(doc, y + 2, words.length * 5 + 4);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.muted);
  doc.text(words, MARGIN, y);
  y += words.length * 5 + 6;

  if (payments.length) {
    y = ensureSpace(doc, y + 4, 30);
    put(doc, "Riwayat pembayaran", MARGIN, y, { size: 11, bold: true });
    y = drawTable(
      doc,
      y + 4,
      [
        { title: "No. Kuitansi", x: MARGIN + 3, width: 56 },
        { title: "Tanggal", x: MARGIN + 62, width: 42 },
        { title: "Jenis", x: MARGIN + 108, width: 24 },
        { title: "Jumlah", x: RIGHT - 3, width: 34, align: "right" }
      ],
      payments.map((p) => [p.nomorKuitansi, formatTanggal(p.tanggalBayar), JENIS[p.jenis] || p.jenis, formatRupiah(p.nominal)])
    );
    y += 6;
  }

  const bank = bankLine(data.vendor);
  if (bank) {
    const lines = doc.splitTextToSize(bank, CONTENT_WIDTH - 10);
    const height = lines.length * 5 + 6;
    y = ensureSpace(doc, y + 2, height);
    doc.setFillColor(...COLOR.soft);
    doc.rect(MARGIN, y, CONTENT_WIDTH, height, "F");
    doc.setFillColor(...COLOR.ink);
    doc.rect(MARGIN, y, 1.6, height, "F");
    put(doc, lines, MARGIN + 6, y + 6, { size: 9.5, bold: true });
    y += height + 4;
  }

  y = ensureSpace(doc, y + 4, 24);
  const note = lunas
    ? "Terima kasih. Tagihan ini telah dilunasi."
    : `Mohon lakukan pelunasan sebesar ${formatRupiah(remaining)} sebelum tanggal acara. Hubungi ${vendor.nama}${vendor.noWa ? ` di ${vendor.noWa}` : ""} untuk konfirmasi pembayaran.`;
  const noteLines = doc.splitTextToSize(note, CONTENT_WIDTH);
  put(doc, "Catatan", MARGIN, y, { size: 10, bold: true });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.muted);
  doc.text(noteLines, MARGIN, y + 5.5);

  drawFooter(doc);
  return doc;
}

export async function downloadInvoicePdf(data) {
  const doc = await buildInvoicePdf(data);
  const number = data.nomor || invoiceNumber(data.vendor && data.vendor.kodeVendor, data.bookingId, data.tanggalAcara);
  doc.save(`Invoice_${safeName(number)}.pdf`);
}