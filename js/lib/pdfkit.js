const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

export const COLOR = {
  ink: [15, 23, 42],
  slate: [30, 41, 59],
  muted: [100, 116, 139],
  line: [203, 213, 225],
  soft: [241, 245, 249],
  white: [255, 255, 255],
  ok: [22, 101, 52],
  warn: [180, 83, 9]
};

export const MARGIN = 18;
export const RIGHT = 192;

let loader = null;

export function loadPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);

  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = JSPDF_URL;
      script.onload = () => resolve(window.jspdf.jsPDF);
      script.onerror = () => {
        loader = null;
        reject(new Error("PDF_GAGAL_DIMUAT"));
      };
      document.head.append(script);
    });
  }

  return loader;
}

const UNITS = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function spell(n) {
  if (n < 12) return UNITS[n];
  if (n < 20) return `${spell(n - 10)} belas`;
  if (n < 100) return `${spell(Math.floor(n / 10))} puluh${n % 10 ? ` ${spell(n % 10)}` : ""}`;
  if (n < 200) return `seratus${n - 100 ? ` ${spell(n - 100)}` : ""}`;
  if (n < 1000) return `${spell(Math.floor(n / 100))} ratus${n % 100 ? ` ${spell(n % 100)}` : ""}`;
  if (n < 2000) return `seribu${n - 1000 ? ` ${spell(n - 1000)}` : ""}`;
  if (n < 1e6) return `${spell(Math.floor(n / 1e3))} ribu${n % 1e3 ? ` ${spell(n % 1e3)}` : ""}`;
  if (n < 1e9) return `${spell(Math.floor(n / 1e6))} juta${n % 1e6 ? ` ${spell(n % 1e6)}` : ""}`;
  if (n < 1e12) return `${spell(Math.floor(n / 1e9))} miliar${n % 1e9 ? ` ${spell(n % 1e9)}` : ""}`;
  return String(n);
}

export function terbilang(value) {
  const n = Math.floor(Number(value) || 0);
  const words = n === 0 ? "nol" : spell(n);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} rupiah`;
}

export function drawHeader(doc, { title, number, vendor }) {
  doc.setTextColor(...COLOR.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(vendor.nama, MARGIN, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.muted);
  const details = [];
  if (vendor.alamat) details.push(...doc.splitTextToSize(vendor.alamat, 95));
  if (vendor.noWa) details.push(`WhatsApp: ${vendor.noWa}`);
  details.forEach((line, i) => doc.text(line, MARGIN, 28 + i * 4.8));

  doc.setTextColor(...COLOR.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(title, RIGHT, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.muted);
  doc.text(number, RIGHT, 29, { align: "right" });

  doc.setDrawColor(...COLOR.ink);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 42, RIGHT, 42);

  return 52;
}

export function infoRow(doc, y, label, value) {
  const x = MARGIN + 46;
  const lines = doc.splitTextToSize(String(value), RIGHT - x);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.muted);
  doc.text(label, MARGIN, y);

  doc.setTextColor(...COLOR.ink);
  doc.setFont("helvetica", "bold");
  doc.text(lines, x, y);

  return y + lines.length * 5 + 3;
}

export function ensureSpace(doc, y, needed) {
  if (y + needed <= 272) return y;
  doc.addPage();
  return 22;
}

export function drawTable(doc, y, columns, rows) {
  const left = MARGIN;
  const width = RIGHT - MARGIN;

  y = ensureSpace(doc, y, 20);
  doc.setFillColor(...COLOR.slate);
  doc.rect(left, y, width, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.white);
  columns.forEach((col) => doc.text(col.title, col.x, y + 5.4, { align: col.align || "left" }));
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLOR.ink);

  rows.forEach((row, index) => {
    const cells = row.map((cell, i) => doc.splitTextToSize(String(cell), columns[i].width));
    const height = Math.max(...cells.map((lines) => lines.length)) * 4.8 + 4;

    y = ensureSpace(doc, y, height);
    if (index % 2) {
      doc.setFillColor(...COLOR.soft);
      doc.rect(left, y, width, height, "F");
    }
    cells.forEach((lines, i) => doc.text(lines, columns[i].x, y + 5.4, { align: columns[i].align || "left" }));
    doc.setDrawColor(...COLOR.line);
    doc.setLineWidth(0.2);
    doc.line(left, y + height, RIGHT, y + height);
    y += height;
  });

  return y;
}

export function drawTotal(doc, y, label, value, { bold = false, left = false } = {}) {
  const labelX = left ? MARGIN : RIGHT - 62;
  const valueX = left ? MARGIN + 62 : RIGHT;
  y = ensureSpace(doc, y, 8);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(bold ? 11 : 10);
  doc.setTextColor(...COLOR.ink);
  doc.text(label, labelX, y);
  doc.text(value, valueX, y, { align: "right" });
  return y + 7;
}

export function drawStamp(doc, text, color, x = 150, y = 70) {
  doc.setTextColor(...color);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text(text, x, y, { angle: 12, align: "center" });
}

export function drawFooter(doc) {
  const pages = doc.getNumberOfPages();

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.muted);
    doc.text("Dokumen ini dibuat otomatis melalui WO Vendor Portal.", MARGIN, 288);
    doc.text(`Halaman ${page} dari ${pages}`, RIGHT, 288, { align: "right" });
  }
}