import {
  addPayment,
  updateTotalTagihan,
  listPayments,
  paymentMessage,
  paymentStatus,
  todayKey
} from "../../services/payments.js";
import { buildReceiptText, whatsappLink, formatRupiah, formatTanggal } from "../../lib/receipt.js";
import { attachMoney, parseMoney, setMoney } from "../../lib/money.js";
import { downloadReceiptPdf, downloadInvoicePdf, pdfMessage } from "../../lib/pdf.js";

const JENIS = { dp: "DP", pelunasan: "Pelunasan" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const PAY_TEMPLATE = `
  <label class="field"><span>Nominal (Rp)</span><input type="text" name="nominal" placeholder="0" required></label>
  <label class="field"><span>Metode</span><select name="metode"><option value="tunai">Tunai</option><option value="transfer">Transfer</option></select></label>
  <label class="field"><span>Tanggal bayar</span><input type="date" name="tanggalBayar" required></label>
  <button class="btn" type="submit">Catat Pembayaran</button>
`;

const TOTAL_TEMPLATE = `
  <label class="field"><span>Total tagihan (Rp)</span><input type="text" name="total" placeholder="0" required></label>
  <button class="btn ghost" type="submit">Ubah Total</button>
`;

export function renderPaymentForm(container, { booking, namaVendor, vendor }) {
  const state = { ...booking, totalTagihan: Number(booking.totalTagihan) || 0, totalDibayar: Number(booking.totalDibayar) || 0 };
  const vendorData = {
    kodeVendor: String(booking.vendorId || "").slice(0, 5).toUpperCase(),
    ...vendor,
    namaVendor: (vendor && vendor.namaVendor) || namaVendor
  };
  let payments = [];

  container.replaceChildren();

  const details = el("details", "stack");
  const summary = el("p", "muted");
  const totalForm = el("form", "stack");
  const list = el("div", "stack");
  const payForm = el("form", "stack");
  const invoiceButton = el("button", "btn ghost", "Unduh Invoice (PDF)");
  const errorBox = el("p", "error");

  invoiceButton.type = "button";
  totalForm.noValidate = true;
  payForm.noValidate = true;
  totalForm.innerHTML = TOTAL_TEMPLATE;
  payForm.innerHTML = PAY_TEMPLATE;
  attachMoney(totalForm.elements.total);
  attachMoney(payForm.elements.nominal);
  payForm.elements.tanggalBayar.value = todayKey();

  details.append(el("summary", "", "Pembayaran"), summary, totalForm, invoiceButton, list, payForm, errorBox);
  container.append(details);

  function refreshSummary() {
    const rest = Math.max(0, state.totalTagihan - state.totalDibayar);
    summary.textContent = `Total ${formatRupiah(state.totalTagihan)} · Dibayar ${formatRupiah(state.totalDibayar)} · Sisa ${formatRupiah(rest)}`;
    setMoney(totalForm.elements.total, state.totalTagihan);
    payForm.hidden = state.totalTagihan > 0 && rest === 0;
    invoiceButton.hidden = state.totalTagihan <= 0;
  }

  function receiptData(payment, cumulative) {
    return {
      nomorKuitansi: payment.nomorKuitansi,
      namaVendor: vendorData.namaVendor,
      namaKlien: state.namaKlien,
      asetId: state.asetId,
      tanggalAcara: state.tanggalAcara,
      jenis: payment.jenis,
      nominal: payment.nominal,
      tanggalBayar: payment.tanggalBayar,
      totalTagihan: state.totalTagihan,
      totalDibayar: cumulative
    };
  }

  function sendReceipt(payment, cumulative) {
    const text = buildReceiptText(receiptData(payment, cumulative));
    window.open(whatsappLink(state.noWaKlien, text), "_blank", "noopener");
  }

  async function runPdf(button, task) {
    errorBox.textContent = "";
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Membuat PDF...";

    try {
      await task();
    } catch (err) {
      console.error(err);
      errorBox.textContent = pdfMessage(err);
    } finally {
      button.disabled = false;
      button.textContent = label;
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
    runPdf(invoiceButton, () =>
      downloadInvoicePdf({
        vendor: vendorData,
        bookingId: state.id,
        namaKlien: state.namaKlien,
        noWaKlien: state.noWaKlien,
        asetId: state.asetId,
        tanggalAcara: state.tanggalAcara,
        totalTagihan: state.totalTagihan,
        totalDibayar: state.totalDibayar,
        payments
      })
    )
  );

  async function loadPayments() {
    try {
      payments = await listPayments(state.id);
      let running = 0;
      list.replaceChildren();
      payments.forEach((payment) => {
        running += payment.nominal;
        const cumulative = running;
        const row = el("div", "stack");
        const actions = el("div", "row");
        const send = el("button", "btn ghost inline", "Kirim Kuitansi");
        const pdf = el("button", "btn ghost inline", "Unduh PDF");
        send.type = "button";
        pdf.type = "button";
        send.addEventListener("click", () => sendReceipt(payment, cumulative));
        pdf.addEventListener("click", () => downloadReceipt(pdf, payment, cumulative));
        actions.append(send, pdf);
        row.append(
          el("span", "", `${payment.nomorKuitansi} · ${JENIS[payment.jenis] || payment.jenis} · ${formatRupiah(payment.nominal)} · ${formatTanggal(payment.tanggalBayar)}`),
          actions
        );
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
    const value = parseMoney(totalForm.elements.total.value);

    try {
      await updateTotalTagihan(state.id, value);
      state.totalTagihan = value;
      state.statusBayar = paymentStatus(state.totalDibayar, value);
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
      const result = await addPayment({
        bookingId: state.id,
        vendorId: state.vendorId,
        nominal: parseMoney(payForm.elements.nominal.value),
        metode: payForm.elements.metode.value,
        tanggalBayar: payForm.elements.tanggalBayar.value || todayKey()
      });
      state.totalDibayar = result.totalDibayar;
      state.statusBayar = paymentStatus(result.totalDibayar, state.totalTagihan);
      setMoney(payForm.elements.nominal, 0);
      refreshSummary();
      await loadPayments();
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