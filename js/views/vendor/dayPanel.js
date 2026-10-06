import { createBooking, cancelBooking, listBookingsByMonth, bookingMessage } from "../../services/bookings.js";
import { CATEGORIES, PAYMENT_STATUS } from "../../constants.js";
import { renderPaymentForm } from "./paymentForm.js";
import { renderBlockForm } from "./blockForm.js";
import { attachMoney, parseMoney } from "../../lib/money.js";

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const label = (id) => LABEL[id] || id;

const tabMemory = { tanggal: "", id: "" };

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

function quotaLevel(detail) {
  if (detail.free === 0) return "penuh";
  if (detail.filled > 0 || detail.closed > 0) return "sebagian";
  return "kosong";
}

function quotaItem(detail) {
  const level = quotaLevel(detail);
  const used = detail.capacity > 0 ? Math.min(100, ((detail.filled + detail.closed) / detail.capacity) * 100) : 100;
  const closed = detail.closed > 0 ? ` · ${detail.closed} ditutup` : "";
  const item = el("div", "quota-item");
  const head = el("div", "row between");
  const bar = el("div", "quota-bar");
  const fill = el("span", `quota-fill ${level}`);

  fill.style.width = `${used}%`;
  bar.append(fill);

  head.append(
    el("strong", "", label(detail.asetId)),
    detail.free === 0 ? el("span", "badge bad", detail.blocked ? "DITUTUP" : "PENUH") : el("span", "badge ok", `Sisa ${detail.free}`)
  );
  item.append(head, bar, el("p", "muted quota-note", `${detail.filled}/${detail.capacity} terisi${closed}`));
  return item;
}

const STATUS_TONE = { belum_bayar: "bad", dp: "", lunas: "ok" };

function createAccordion() {
  const setters = new Map();
  let openId = "";

  return {
    register(id, setOpen) {
      setters.set(id, setOpen);
      setOpen(false);
    },
    toggle(id) {
      openId = openId === id ? "" : id;
      setters.forEach((setOpen, key) => setOpen(key === openId));
      return openId === id;
    }
  };
}

function bookingCard(booking, accordion, onCancel, namaVendor, vendor) {
  const card = el("article", "card booking-card");
  const head = el("button", "booking-head");
  const main = el("div", "booking-head-main");
  const badge = el("span", "badge");
  const body = el("div", "collapse");
  const inner = el("div", "collapse-inner stack");
  const paymentBox = el("div");
  const footer = el("div", "booking-footer");
  const cancel = el("button", "btn danger inline", "Batalkan Booking");
  const venue = [booking.jamAcara && `Pukul ${booking.jamAcara}`, booking.lokasi].filter(Boolean).join(" · ");

  function setStatus(status) {
    badge.textContent = PAYMENT_STATUS[status] || status;
    badge.className = `badge ${STATUS_TONE[status] || ""}`.trim();
  }

  function setOpen(open) {
    body.classList.toggle("open", open);
    body.inert = !open;
    head.setAttribute("aria-expanded", String(open));
  }

  head.type = "button";
  cancel.type = "button";
  body.inert = true;

  main.append(el("strong", "", booking.namaKlien));
  if (venue) main.append(el("span", "muted booking-venue", venue));
  head.append(main, badge);
  setStatus(booking.statusBayar);

  renderPaymentForm(paymentBox, { booking, namaVendor, vendor, onStatus: setStatus });

  head.addEventListener("click", () => {
    if (!accordion.toggle(booking.id)) return;
    window.setTimeout(() => head.scrollIntoView({ behavior: "smooth", block: "nearest" }), 240);
  });

  cancel.addEventListener("click", () => {
    if (!window.confirm(`Batalkan booking ${booking.namaKlien} (${label(booking.asetId)})? Slot akan dikembalikan dan tindakan ini tidak bisa diurungkan.`)) return;
    cancel.disabled = true;
    onCancel(booking.id);
  });

  footer.append(cancel);
  inner.append(el("p", "muted", `${label(booking.asetId)} · slot ${booking.slotKe} · ${booking.noWaKlien}`), paymentBox, footer);
  body.append(inner);
  card.append(head, body);
  accordion.register(booking.id, setOpen);
  return card;
}

function assetChoice(detail) {
  return `
    <div class="asset-row">
      <label class="check">
        <input type="checkbox" name="aset" value="${detail.asetId}">
        <span>${label(detail.asetId)} <small class="muted">sisa ${detail.free}</small></span>
      </label>
      <input type="text" name="total-${detail.asetId}" placeholder="Total Rp" aria-label="Total tagihan ${label(detail.asetId)}" disabled>
    </div>
  `;
}

function formTemplate(freeDetails) {
  return `
    <div class="stack">
      <span class="muted">Pilih aset dan isi total tagihannya</span>
      ${freeDetails.map(assetChoice).join("")}
    </div>
    <label class="field"><span>Nama klien</span><input type="text" name="namaKlien" maxlength="80" required></label>
    <label class="field"><span>WhatsApp klien</span><input type="tel" name="noWaKlien" inputmode="tel" required></label>
    <div class="field-row">
      <label class="field"><span>Jam acara</span><input type="time" name="jamAcara"></label>
      <label class="field"><span>Lokasi acara</span><input type="text" name="lokasi" maxlength="120" placeholder="Rumah, gedung, hotel"></label>
    </div>
    <label class="field"><span>Catatan</span><input type="text" name="catatan" maxlength="200"></label>
    <p class="error" data-error></p>
    <button class="btn" type="submit">Simpan Booking</button>
  `;
}

function createTabs(items, onSelect) {
  const bar = el("div", "tabs");
  const buttons = new Map();

  bar.setAttribute("role", "tablist");
  items.forEach(({ id, title, pane, disabled }) => {
    const button = el("button", "tab", title);
    button.type = "button";
    button.disabled = Boolean(disabled);
    button.setAttribute("role", "tab");
    button.addEventListener("click", () => select(id));
    buttons.set(id, button);
    bar.append(button);
  });

  function select(id) {
    items.forEach((item) => {
      const active = item.id === id;
      buttons.get(item.id).setAttribute("aria-selected", String(active));
      item.pane.hidden = !active;
    });
    if (onSelect) onSelect(id);
  }

  function setTitle(id, title) {
    buttons.get(id).textContent = title;
  }

  function isEnabled(id) {
    return !buttons.get(id).disabled;
  }

  return { bar, select, setTitle, isEnabled };
}

export function renderDayPanel(container, { vendorId, namaVendor, vendor, aset, tanggal, details, onChanged }) {
  container.replaceChildren();

  const panel = el("section", "card stack");
  const quota = el("div", "stack");
  const bookings = el("div", "stack");
  const summaryPane = el("div", "stack");
  const blockBox = el("div");
  const bookingPane = el("div", "stack");
  const formPane = el("div", "stack");
  const form = el("form", "stack");
  form.noValidate = true;

  const freeDetails = details.filter((d) => d.free > 0);
  const tabs = createTabs(
    [
      { id: "ringkasan", title: "Ringkasan", pane: summaryPane },
      { id: "booking", title: "Booking", pane: bookingPane },
      { id: "baru", title: freeDetails.length > 0 ? "Baru" : "Baru (penuh)", pane: formPane, disabled: freeDetails.length === 0 }
    ],
    (id) => {
      tabMemory.tanggal = tanggal;
      tabMemory.id = id;
    }
  );

  summaryPane.append(quota, blockBox);
  bookingPane.append(bookings);
  formPane.append(form);
  panel.append(el("h2", "", formatDate(tanggal)), tabs.bar, summaryPane, bookingPane, formPane);
  container.append(panel);

  const remembered = tabMemory.tanggal === tanggal ? tabMemory.id : "ringkasan";
  tabs.select(tabs.isEnabled(remembered) ? remembered : "ringkasan");

  renderBlockForm(blockBox, { vendorId, aset, tanggal, onChanged });

  details.forEach((d) => quota.append(quotaItem(d)));
  if (details.length === 0) quota.append(el("p", "muted", "Belum ada aset terdaftar."));
  if (details.length > 0 && freeDetails.length === 0) {
    quota.prepend(el("p", "error", "Fully booked: semua aset penuh atau ditutup pada tanggal ini."));
  }

  if (freeDetails.length > 0) {
    form.innerHTML = formTemplate(freeDetails);
    freeDetails.forEach((d) => attachMoney(form.elements[`total-${d.asetId}`]));
    form.addEventListener("change", (event) => {
      if (event.target.name !== "aset") return;
      const input = form.elements[`total-${event.target.value}`];
      input.disabled = !event.target.checked;
      if (event.target.checked) input.focus();
    });
  }

  async function loadBookings() {
    try {
      const month = await listBookingsByMonth(vendorId, tanggal.slice(0, 7));
      const list = month.filter((b) => b.tanggalAcara === tanggal);
      const accordion = createAccordion();
      list.forEach((b) => bookings.append(bookingCard(b, accordion, handleCancel, namaVendor, vendor)));
      tabs.setTitle("booking", list.length > 0 ? `Booking (${list.length})` : "Booking");
      if (list.length === 0) bookings.append(emptyBookings());
    } catch (err) {
      console.error(err);
      bookings.append(el("p", "error", "Gagal memuat booking."));
    }
  }

  function emptyBookings() {
    const box = el("div", "stack");
    box.append(el("p", "muted", "Belum ada booking pada tanggal ini."));
    if (tabs.isEnabled("baru")) {
      const go = el("button", "btn ghost inline", "Buat Booking Baru");
      go.type = "button";
      go.addEventListener("click", () => tabs.select("baru"));
      box.append(go);
    }
    return box;
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
    const chosen = Array.from(form.querySelectorAll('input[name="aset"]:checked')).map((box) => box.value);
    const namaKlien = form.elements.namaKlien.value.trim();
    const noWaKlien = form.elements.noWaKlien.value.trim();

    errorBox.textContent = "";
    if (chosen.length === 0) {
      errorBox.textContent = "Pilih minimal satu aset.";
      return;
    }
    if (!namaKlien || !noWaKlien) {
      errorBox.textContent = "Nama dan WhatsApp klien wajib diisi.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Menyimpan...";

    const failed = [];
    let saved = 0;

    for (const asetId of chosen) {
      const target = aset.find((a) => a.id === asetId);
      try {
        await createBooking({
          vendorId,
          asetId,
          tanggalAcara: tanggal,
          kapasitasPerHari: target.kapasitasPerHari,
          namaKlien,
          noWaKlien,
          jamAcara: form.elements.jamAcara.value,
          lokasi: form.elements.lokasi.value,
          catatan: form.elements.catatan.value,
          totalTagihan: parseMoney(form.elements[`total-${asetId}`].value)
        });
        saved += 1;
        const box = form.querySelector(`input[name="aset"][value="${asetId}"]`);
        box.checked = false;
        box.disabled = true;
        form.elements[`total-${asetId}`].disabled = true;
      } catch (err) {
        console.error(err);
        failed.push(`${label(asetId)}: ${bookingMessage(err)}`);
      }
    }

    if (failed.length === 0) {
      tabMemory.tanggal = tanggal;
      tabMemory.id = "booking";
      onChanged();
      return;
    }

    errorBox.textContent = `${saved} aset tersimpan. Gagal: ${failed.join(" ")}`;
    bookings.replaceChildren();
    loadBookings();
    submit.disabled = false;
    submit.textContent = "Simpan Booking";
  });

  loadBookings();
}