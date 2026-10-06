import { createBooking, cancelBooking, listBookingsByMonth, bookingMessage } from "../../services/bookings.js";
import { CATEGORIES, PAYMENT_STATUS } from "../../constants.js";
import { renderPaymentForm } from "./paymentForm.js";
import { attachMoney, parseMoney } from "../../lib/money.js";

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const label = (id) => LABEL[id] || id;

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "full" });

function formatDate(tanggal) {
  const [y, m, d] = tanggal.split("-").map(Number);
  return dateFormat.format(new Date(y, m - 1, d));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function quotaLine(detail) {
  const closed = detail.closed > 0 ? ` · ${detail.closed} ditutup` : "";
  return `${label(detail.asetId)}: ${detail.filled}/${detail.capacity} terisi${closed}`;
}

function bookingCard(booking, onCancel, namaVendor, vendor) {
  const card = el("article", "card stack");
  const paymentBox = el("div");
  renderPaymentForm(paymentBox, { booking, namaVendor, vendor });
  const cancel = el("button", "btn ghost inline", "Batalkan");
  cancel.type = "button";
  cancel.addEventListener("click", () => {
    if (!window.confirm("Batalkan booking ini?")) return;
    cancel.disabled = true;
    onCancel(booking.id);
  });

  card.append(
    el("h3", "", booking.namaKlien),
    el("p", "muted", `${label(booking.asetId)} · slot ${booking.slotKe} · ${booking.noWaKlien}`),
    el("p", "", PAYMENT_STATUS[booking.statusBayar] || booking.statusBayar),
    paymentBox,
    cancel
  );
  return card;
}

function formTemplate(freeDetails) {
  const options = freeDetails
    .map((d) => `<option value="${d.asetId}">${label(d.asetId)} (sisa ${d.free})</option>`)
    .join("");

  return `
    <h3>Booking Baru</h3>
    <label class="field"><span>Aset</span><select name="asetId">${options}</select></label>
    <label class="field"><span>Nama klien</span><input type="text" name="namaKlien" maxlength="80" required></label>
    <label class="field"><span>WhatsApp klien</span><input type="tel" name="noWaKlien" inputmode="tel" required></label>
    <label class="field"><span>Total tagihan (Rp)</span><input type="text" name="totalTagihan" placeholder="0"></label>
    <label class="field"><span>Catatan</span><input type="text" name="catatan" maxlength="200"></label>
    <p class="error" data-error></p>
    <button class="btn" type="submit">Simpan Booking</button>
  `;
}

export function renderDayPanel(container, { vendorId, namaVendor, vendor, aset, tanggal, details, onChanged }) {
  container.replaceChildren();

  const panel = el("section", "card stack");
  const quota = el("div", "stack");
  const bookings = el("div", "stack");
  const form = el("form", "stack");
  form.noValidate = true;

  panel.append(el("h2", "", formatDate(tanggal)), quota, bookings, form);
  container.append(panel);

  details.forEach((d) => quota.append(el("p", "muted", quotaLine(d))));
  if (details.length === 0) quota.append(el("p", "muted", "Belum ada aset terdaftar."));

  const freeDetails = details.filter((d) => d.free > 0);
  if (freeDetails.length === 0) {
    form.replaceWith(el("p", "muted", "Tidak ada slot tersedia pada tanggal ini."));
  } else {
    form.innerHTML = formTemplate(freeDetails);
    attachMoney(form.elements.totalTagihan);
  }

  async function loadBookings() {
    try {
      const month = await listBookingsByMonth(vendorId, tanggal.slice(0, 7));
      month
        .filter((b) => b.tanggalAcara === tanggal)
        .forEach((b) => bookings.append(bookingCard(b, handleCancel, namaVendor, vendor)));
    } catch (err) {
      console.error(err);
      bookings.append(el("p", "error", "Gagal memuat booking."));
    }
  }

  async function handleCancel(bookingId) {
    try {
      await cancelBooking(bookingId);
      onChanged();
    } catch (err) {
      console.error(err);
      bookings.append(el("p", "error", bookingMessage(err)));
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const errorBox = form.querySelector("[data-error]");
    const submit = form.querySelector('button[type="submit"]');
    const asetId = form.elements.asetId.value;
    const namaKlien = form.elements.namaKlien.value.trim();
    const noWaKlien = form.elements.noWaKlien.value.trim();

    errorBox.textContent = "";
    if (!namaKlien || !noWaKlien) {
      errorBox.textContent = "Nama dan WhatsApp klien wajib diisi.";
      return;
    }

    const target = aset.find((a) => a.id === asetId);
    submit.disabled = true;
    submit.textContent = "Menyimpan...";

    try {
      await createBooking({
        vendorId,
        asetId,
        tanggalAcara: tanggal,
        kapasitasPerHari: target.kapasitasPerHari,
        namaKlien,
        noWaKlien,
        catatan: form.elements.catatan.value,
        totalTagihan: parseMoney(form.elements.totalTagihan.value)
      });
      onChanged();
    } catch (err) {
      console.error(err);
      errorBox.textContent = bookingMessage(err);
      submit.disabled = false;
      submit.textContent = "Simpan Booking";
    }
  });

  loadBookings();
}