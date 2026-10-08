import {
  addGroupPayment,
  updateGroupTotals,
  listGroupPayments,
  paymentMessage,
  paymentStatus,
  todayKey
} from "../../services/payments.js";
import { buildReceiptText, whatsappLink, formatRupiah, formatTanggal, layananLabel } from "../../lib/receipt.js";
import { statusOf } from "../../lib/bookingGroup.js";
import { attachMoney, parseMoney, setMoney } from "../../lib/money.js";
import { downloadReceiptPdf, downloadInvoicePdf, pdfMessage } from "../../lib/pdf.js";

const JENIS = { dp: "DP", pelunasan: "Pelunasan" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const ICONS = {
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>'
};

function iconButton(kind, className, label) {
  const button = el("button", `btn icon-btn ${className}`);
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = ICONS[kind];
  return button;
}

const PAY_TEMPLATE = `
  <label class="field"><span>Nominal (Rp)</span><input type="text" name="nominal" placeholder="0" required></label>
  <label class="field"><span>Metode</span><select name="metode"><option value="tunai">Tunai</option><option value="transfer">Transfer</option></select></label>
  <label class="field"><span>Tanggal bayar</span><input type="date" name="tanggalBayar" required></label>
  <button class="btn" type="submit">Simpan Pembayaran</button>
`;

function totalTemplate(items) {
  const single = items.length === 1;
  const fields = items
    .map((item) => {
      const title = single ? "Total tagihan (Rp)" : `Total ${layananLabel(item.asetId)} (Rp)`;
      return `<label class="field"><span>${title}</span><input type="text" name="total-${item.asetId}" placeholder="0" required></label>`;
    })
    .join("");
  return `${fields}<button class="btn ghost" type="submit">Ubah Total</button>`;
}

function createSection(title, ...children) {
  const toggle = el("button", "section-toggle", title);
  const root = el("div", "collapse");
  const inner = el("div", "collapse-inner stack");

  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  inner.append(...children);
  root.append(inner);
  root.inert = true;

  function setOpen(open) {
    root.classList.toggle("open", open);
    root.inert = !open;
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", () => setOpen(!root.classList.contains("open")));

  return { toggle, root, setOpen, setTitle: (text) => (toggle.textContent = text) };
}

function sumOf(items, field) {
  return items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
}

export function renderPaymentForm(container, { group, namaVendor, vendor, onStatus }) {
  const state = {
    ...group,
    items: group.items.map((item) => ({
      ...item,
      totalTagihan: Number(item.totalTagihan) || 0,
      totalDibayar: Number(item.totalDibayar) || 0
    }))
  };
  const vendorData = {
    kodeVendor: String(group.vendorId || "").slice(0, 5).toUpperCase(),
    ...vendor,
    namaVendor: (vendor && vendor.namaVendor) || namaVendor
  };
  const bookingIds = state.items.map((item) => item.id);
  let payments = [];

  container.replaceChildren();

  const intro = el("div", "payment-intro");
  intro.append(
    el("p", "eyebrow", "PAYMENT OVERVIEW"),
    el("h3", "section-title", "Pembayaran Booking"),
    el("p", "muted", "Kelola tagihan, pembayaran, invoice, dan kuitansi dari satu panel.")
  );
  const amounts = el("div", "amounts payment-summary");
  const amountText = {};
  [["total", "Total"], ["paid", "Dibayar"], ["rest", "Sisa"]].forEach(([key, title]) => {
    const cell = el("div", "amount");
    amountText[key] = el("strong", "", "");
    cell.append(el("span", "muted", title), amountText[key]);
    amounts.append(cell);
  });
  const totalForm = el("form", "stack");
  const list = el("div", "stack");
  const payForm = el("form", "stack");
  const invoiceButton = el("button", "btn ghost", "Unduh Invoice (PDF)");
  const errorBox = el("p", "error");
  const payButton = el("button", "btn accent", "+ Catat Pembayaran");
  const payHint = el("p", "muted", "Isi total tagihan terlebih dahulu.");
  const payPanel = createSection("Catat Pembayaran", payForm);
  const history = createSection("Riwayat Pembayaran", list);
  const billing = createSection("Total Tagihan & Invoice", totalForm, invoiceButton);
  const root = el("div", "stack payment-panel");

  payButton.type = "button";
  payButton.setAttribute("aria-expanded", "false");
  invoiceButton.type = "button";
  totalForm.noValidate = true;
  payForm.noValidate = true;
  totalForm.innerHTML = totalTemplate(state.items);
  payForm.innerHTML = PAY_TEMPLATE;
  state.items.forEach((item) => attachMoney(totalForm.elements[`total-${item.asetId}`]));
  attachMoney(payForm.elements.nominal);
  payForm.elements.tanggalBayar.value = todayKey();

  root.append(
    intro,
    amounts,
    payButton,
    payHint,
    payPanel.root,
    history.toggle,
    history.root,
    billing.toggle,
    billing.root,
    errorBox
  );
  container.append(root);

  function totals() {
    const total = sumOf(state.items, "totalTagihan");
    const paid = sumOf(state.items, "totalDibayar");
    return { total, paid, rest: Math.max(0, total - paid) };
  }

  function setPayOpen(open) {
    payPanel.setOpen(open);
    payButton.setAttribute("aria-expanded", String(open));
    payButton.textContent = open ? "Tutup Form Pembayaran" : "+ Catat Pembayaran";
    payButton.classList.toggle("open", open);
  }

  payButton.addEventListener("click", () => setPayOpen(!payPanel.root.classList.contains("open")));

  function refreshSummary() {
    const { total, paid, rest } = totals();
    amountText.total.textContent = formatRupiah(total);
    amountText.paid.textContent = formatRupiah(paid);
    amountText.rest.textContent = formatRupiah(rest);
    amounts.classList.toggle("settled", total > 0 && rest === 0);
    state.items.forEach((item) => setMoney(totalForm.elements[`total-${item.asetId}`], item.totalTagihan));
    const noTotal = total <= 0;
    const settled = !noTotal && rest === 0;
    payButton.hidden = settled;
    payButton.disabled = noTotal;
    payHint.hidden = !noTotal;
    invoiceButton.hidden = noTotal;
    if (settled || noTotal) setPayOpen(false);
    if (noTotal) billing.setOpen(true);
    if (onStatus) onStatus(statusOf(paid, total));
  }

  function allocate(amount) {
    let left = amount;
    state.items.forEach((item) => {
      const share = Math.min(Math.max(0, item.totalTagihan - item.totalDibayar), left);
      if (share <= 0) return;
      left -= share;
      item.totalDibayar += share;
      item.statusBayar = paymentStatus(item.totalDibayar, item.totalTagihan);
    });
  }

  function receiptData(payment, cumulative) {
    return {
      nomorKuitansi: payment.nomorKuitansi,
      namaVendor: vendorData.namaVendor,
      namaKlien: state.namaKlien,
      asetIds: state.items.map((item) => item.asetId),
      tanggalAcara: state.tanggalAcara,
      jamAcara: state.jamAcara,
      lokasi: state.lokasi,
      jenis: payment.jenis,
      nominal: payment.nominal,
      tanggalBayar: payment.tanggalBayar,
      totalTagihan: totals().total,
      totalDibayar: cumulative
    };
  }

  function sendReceipt(payment, cumulative) {
    const text = buildReceiptText(receiptData(payment, cumulative));
    window.open(whatsappLink(state.noWaKlien, text), "_blank", "noopener");
  }

  async function runPdf(button, task) {
    errorBox.textContent = "";
    const compact = button.classList.contains("icon-btn");
    const label = button.textContent;
    button.disabled = true;
    if (!compact) button.textContent = "Membuat PDF...";

    try {
      await task();
    } catch (err) {
      console.error(err);
      errorBox.textContent = pdfMessage(err);
    } finally {
      button.disabled = false;
      if (!compact) button.textContent = label;
    }
  }

  function downloadReceipt(button, payment, cumulative) {
    return runPdf(button, () =>
      downloadReceiptPdf({
        ...receiptData(payment, cumulative),
        vendor: vendorData,
        metode: payment.metode
      })
    );
  }

  invoiceButton.addEventListener("click", () =>
    runPdf(invoiceButton, () => {
      const { total, paid } = totals();
      return downloadInvoicePdf({
        vendor: vendorData,
        bookingId: state.id,
        namaKlien: state.namaKlien,
        noWaKlien: state.noWaKlien,
        items: state.items
          .filter((item) => item.totalTagihan > 0)
          .map((item) => ({ asetId: item.asetId, totalTagihan: item.totalTagihan })),
        tanggalAcara: state.tanggalAcara,
        jamAcara: state.jamAcara,
        lokasi: state.lokasi,
        totalTagihan: total,
        totalDibayar: paid,
        payments
      });
    })
  );

  async function loadPayments() {
    try {
      payments = await listGroupPayments(bookingIds);
      let running = 0;
      list.replaceChildren();
      history.setTitle(payments.length > 0 ? `Riwayat Pembayaran (${payments.length})` : "Riwayat Pembayaran");
      if (payments.length === 0) list.append(el("p", "muted", "Belum ada pembayaran."));
      payments.forEach((payment) => {
        running += payment.nominal;
        const cumulative = running;
        const row = el("div", "pay-row");
        const info = el("div", "pay-info");
        const actions = el("div", "pay-actions");
        const send = iconButton("send", "receipt-send", "Kirim kuitansi via WhatsApp");
        const pdf = iconButton("download", "receipt-pdf", "Unduh kuitansi PDF");
        send.addEventListener("click", () => sendReceipt(payment, cumulative));
        pdf.addEventListener("click", () => downloadReceipt(pdf, payment, cumulative));
        const meta = el("div", "pay-meta");
        meta.append(el("span", "", formatTanggal(payment.tanggalBayar)), el("span", "pay-code", payment.nomorKuitansi));
        info.append(
          el("strong", "", `${JENIS[payment.jenis] || payment.jenis} · ${formatRupiah(payment.nominal)}`),
          meta
        );
        actions.append(send, pdf);
        row.append(info, actions);
        list.append(row);
      });
    } catch (err) {
      console.error(err);
      errorBox.textContent = "Gagal memuat pembayaran.";
    }
  }

  totalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";

    const entries = state.items.map((item) => ({
      id: item.id,
      total: parseMoney(totalForm.elements[`total-${item.asetId}`].value)
    }));

    try {
      await updateGroupTotals(entries);
      state.items.forEach((item, index) => {
        item.totalTagihan = entries[index].total;
        item.statusBayar = paymentStatus(item.totalDibayar, item.totalTagihan);
      });
      refreshSummary();
    } catch (err) {
      console.error(err);
      errorBox.textContent = paymentMessage(err);
    }
  });

  payForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";

    const submit = payForm.querySelector('button[type="submit"]');
    submit.disabled = true;

    try {
      const nominal = parseMoney(payForm.elements.nominal.value);
      await addGroupPayment({
        bookingIds,
        vendorId: state.vendorId,
        nominal,
        metode: payForm.elements.metode.value,
        tanggalBayar: payForm.elements.tanggalBayar.value || todayKey()
      });
      allocate(nominal);
      setMoney(payForm.elements.nominal, 0);
      refreshSummary();
      setPayOpen(false);
      await loadPayments();
      history.setOpen(true);
    } catch (err) {
      console.error(err);
      errorBox.textContent = paymentMessage(err);
    } finally {
      submit.disabled = false;
    }
  });

  refreshSummary();
  loadPayments();
}
