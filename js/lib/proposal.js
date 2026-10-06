import { CATEGORIES } from "../constants.js";
import { formatRupiah, formatTanggal, whatsappLink } from "./receipt.js";

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

export function buildProposalText({ merek, namaKlien, namaPaket, tanggalAcara, items, hargaJual }) {
  const lines = items.map((item) => `- ${LABEL[item.asetId] || item.asetId}: ${formatRupiah(item.hargaJualItem)}`);

  return [
    `*PENAWARAN ${merek.toUpperCase()}*`,
    "",
    `Kepada: ${namaKlien}`,
    `Paket: ${namaPaket}`,
    `Tanggal acara: ${formatTanggal(tanggalAcara)}`,
    "",
    "Rincian layanan:",
    ...lines,
    "",
    `*Total: ${formatRupiah(hargaJual)}*`,
    "",
    `Terima kasih telah mempercayakan acara Anda kepada ${merek}.`
  ].join("\n");
}

export function proposalLink(phone, text) {
  return whatsappLink(phone, text);
}
