import {
  getPackage,
  savePackageItems,
  setPackageStatus,
  listClients,
  PACKAGE_STATUS
} from "../../services/packages.js";
import { loadActiveVendors } from "../../services/availability.js";
import { loadAllCosts } from "../../services/costs.js";
import { summarize, applyMarkup } from "../../lib/costing.js";
import { buildProposalText, proposalLink } from "../../lib/proposal.js";
import { formatRupiah, formatTanggal } from "../../lib/receipt.js";
import { renderChecker } from "./checker.js";
import { CATEGORIES } from "../../constants.js";
import { attachMoney, parseMoney, setMoney } from "../../lib/money.js";

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className, onClick) {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

export async function renderPackageBuilder(container, { packageId, merek = "Wedding Organizer", onBack }) {
  container.replaceChildren(el("p", "loading", "Memuat..."));

  let pkg;
  let vendors;
  let costs;
  let clients;
  try {
    [pkg, vendors, costs, clients] = await Promise.all([
      getPackage(packageId),
      loadActiveVendors(),
      loadAllCosts(),
      listClients()
    ]);
  } catch (err) {
    console.error(err);
    container.replaceChildren(el("p", "error", "Gagal memuat paket."));
    return;
  }

  if (!pkg) {
    container.replaceChildren(el("p", "error", "Paket tidak ditemukan."));
    return;
  }

  const names = new Map(vendors.map((v) => [v.id, v.namaVendor]));
  const client = clients.find((c) => c.id === pkg.klienWoId);
  const items = pkg.items.map(({ vendorId, asetId, hargaModal, hargaJualItem }) => ({
    vendorId,
    asetId,
    hargaModal,
    hargaJualItem
  }));

  const root = el("section", "stack");
  const badge = el("span", "badge", PACKAGE_STATUS[pkg.status] || pkg.status);
  const badgeRow = el("div");
  badgeRow.append(badge);
  const list = el("div", "stack");
  const summary = el("p");
  const message = el("p", "error");
  const checkerBox = el("div", "stack");
  const markupInput = el("input");
  const markupField = el("label", "field");
  const saveButton = button("Simpan Paket", "btn", save);

  markupInput.type = "number";
  markupInput.min = "0";
  markupInput.step = "1";
  markupInput.value = "20";
  markupField.append(el("span", "", "Markup (%)"), markupInput);

  const statusRow = el("div", "row");
  ["ditawarkan", "deal", "batal"].forEach((status) => {
    statusRow.append(button(PACKAGE_STATUS[status], "btn ghost", () => changeStatus(status)));
  });

  root.append(
    button("Kembali", "btn ghost inline", onBack),
    el("h2", "", pkg.namaPaket),
    el("p", "muted", `${client ? client.nama : "Klien tidak ditemukan"} · ${formatTanggal(pkg.tanggalAcara)}`),
    badgeRow,
    list,
    markupField,
    button("Terapkan Markup", "btn ghost", applyAll),
    summary,
    message,
    saveButton,
    button("Kirim Penawaran", "btn ghost", sendProposal),
    statusRow,
    el("h3", "", "Tambah Vendor"),
    checkerBox
  );
  container.replaceChildren(root);

  renderChecker(checkerBox, { onPick: addItem, tanggal: pkg.tanggalAcara });
  drawItems();

  function refreshSummary() {
    const { totalModal, hargaJual, margin, marginPersen } = summarize(items);
    summary.textContent = `Modal ${formatRupiah(totalModal)} · Jual ${formatRupiah(hargaJual)} · Margin ${formatRupiah(margin)} (${marginPersen.toFixed(1)}%)`;
    saveButton.textContent = "Simpan Paket";
  }

  function drawItems() {
    list.replaceChildren();
    if (items.length === 0) list.append(el("p", "muted", "Belum ada item. Tambahkan vendor di bawah."));

    items.forEach((item, index) => {
      const card = el("article", "card stack");
      const field = el("label", "field");
      const input = el("input");

      attachMoney(input);
      setMoney(input, item.hargaJualItem);
      input.addEventListener("input", () => {
        item.hargaJualItem = parseMoney(input.value);
        refreshSummary();
      });
      field.append(el("span", "", "Harga jual (Rp)"), input);

      card.append(
        el("h3", "", `${LABEL[item.asetId] || item.asetId} · ${names.get(item.vendorId) || item.vendorId}`),
        el("p", "muted", `Harga modal ${formatRupiah(item.hargaModal)}`),
        field,
        button("Hapus", "btn ghost inline", () => {
          items.splice(index, 1);
          drawItems();
        })
      );
      list.append(card);
    });

    refreshSummary();
  }

  function addItem(pick) {
    message.textContent = "";
    if (items.some((i) => i.vendorId === pick.vendorId && i.asetId === pick.asetId)) {
      message.textContent = "Item ini sudah ada di paket.";
      return;
    }

    const modal = Number((costs.get(pick.vendorId) || {})[pick.asetId]) || 0;
    items.push({ vendorId: pick.vendorId, asetId: pick.asetId, hargaModal: modal, hargaJualItem: modal });
    if (modal === 0) message.textContent = `Harga modal ${pick.namaVendor} belum diisi di tab Harga.`;
    drawItems();
  }

  function applyAll() {
    items.forEach((item) => {
      item.hargaJualItem = applyMarkup(item.hargaModal, markupInput.value);
    });
    drawItems();
  }

  async function save() {
    message.textContent = "";
    saveButton.disabled = true;
    try {
      await savePackageItems(packageId, items);
      saveButton.textContent = "Tersimpan";
    } catch (err) {
      console.error(err);
      message.textContent = "Gagal menyimpan paket.";
    } finally {
      saveButton.disabled = false;
    }
  }

  async function changeStatus(status) {
    message.textContent = "";
    try {
      await setPackageStatus(packageId, status);
      badge.textContent = PACKAGE_STATUS[status];
    } catch (err) {
      console.error(err);
      message.textContent = "Gagal mengubah status.";
    }
  }

  function sendProposal() {
    message.textContent = "";
    if (!client || items.length === 0) {
      message.textContent = "Lengkapi klien dan item paket terlebih dahulu.";
      return;
    }

    const text = buildProposalText({
      merek,
      namaKlien: client.nama,
      namaPaket: pkg.namaPaket,
      tanggalAcara: pkg.tanggalAcara,
      items,
      hargaJual: summarize(items).hargaJual
    });
    window.open(proposalLink(client.noWa, text), "_blank", "noopener");
  }
}