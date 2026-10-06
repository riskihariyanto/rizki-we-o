import { loadMonthOverview } from "../../services/availability.js";
import { freeSlots } from "../../lib/availability.js";
import { ALL_ASSETS } from "../../services/blocks.js";
import { CATEGORIES } from "../../constants.js";

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const TEMPLATE = `
  <div class="card stack">
    <div class="row between">
      <button class="btn ghost inline" type="button" data-nav="-1" aria-label="Bulan sebelumnya">&lsaquo;</button>
      <h3 data-title></h3>
      <button class="btn ghost inline" type="button" data-nav="1" aria-label="Bulan berikutnya">&rsaquo;</button>
    </div>
    <div class="cal-grid" data-grid></div>
    <p class="cal-legend muted">
      <span class="dot kosong"></span>Kosong
      <span class="dot sebagian"></span>Terisi sebagian
      <span class="dot penuh"></span>Penuh/ditutup
    </p>
    <p class="error" data-error></p>
    <div class="stack" data-detail></div>
  </div>
`;

const pad = (n) => String(n).padStart(2, "0");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function dayStats(data, tanggal) {
  const byCategory = new Map();
  let capacity = 0;
  let free = 0;
  let touched = false;

  data.vendors.forEach((vendor) => {
    vendor.aset.forEach((item) => {
      const filled = data.slotMap.get(`${vendor.id}|${item.id}|${tanggal}`) || 0;
      const relevant = (data.blocksByDate.get(tanggal) || []).filter(
        (b) => b.vendorId === vendor.id && (b.asetId === item.id || b.asetId === ALL_ASSETS)
      );
      const result = freeSlots(item.kapasitasPerHari, filled, relevant);

      capacity += item.kapasitasPerHari;
      free += result.free;
      if (filled > 0 || result.closed > 0) touched = true;

      const entry = byCategory.get(item.kategori) || { capacity: 0, free: 0, vendors: 0 };
      entry.capacity += item.kapasitasPerHari;
      entry.free += result.free;
      entry.vendors += 1;
      byCategory.set(item.kategori, entry);
    });
  });

  let status = "kosong";
  if (capacity > 0 && free === 0) status = "penuh";
  else if (touched) status = "sebagian";

  return { byCategory, status };
}

export function renderOverview(container) {
  container.innerHTML = TEMPLATE;

  const title = container.querySelector("[data-title]");
  const grid = container.querySelector("[data-grid]");
  const detail = container.querySelector("[data-detail]");
  const errorBox = container.querySelector("[data-error]");

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let selected = "";
  let data = { vendors: [], slotMap: new Map(), blocksByDate: new Map() };
  let token = 0;

  function drawDetail() {
    detail.replaceChildren();
    if (!selected) return;

    detail.append(el("h3", "", selected));
    const { byCategory } = dayStats(data, selected);
    if (byCategory.size === 0) {
      detail.append(el("p", "muted", "Belum ada vendor aktif."));
      return;
    }
    byCategory.forEach((entry, kategori) => {
      detail.append(
        el("p", "", `${LABEL[kategori] || kategori}: sisa ${entry.free} dari ${entry.capacity} slot · ${entry.vendors} aset`)
      );
    });
  }

  function draw() {
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const cells = Array(offset).fill("<span></span>");

    for (let day = 1; day <= total; day += 1) {
      const tanggal = `${year}-${pad(month + 1)}-${pad(day)}`;
      const extra = tanggal === selected ? " selected" : "";
      cells.push(`<button type="button" class="cal-day ${dayStats(data, tanggal).status}${extra}" data-date="${tanggal}">${day}</button>`);
    }

    title.textContent = `${MONTHS[month]} ${year}`;
    grid.innerHTML = WEEKDAYS.map((w) => `<span class="cal-head">${w}</span>`).join("") + cells.join("");
    drawDetail();
  }

  async function load() {
    const id = ++token;
    errorBox.textContent = "";

    try {
      const raw = await loadMonthOverview(`${year}-${pad(month + 1)}`);
      if (id !== token) return;

      const blocksByDate = new Map();
      raw.blocks.forEach((b) => blocksByDate.set(b.tanggal, (blocksByDate.get(b.tanggal) || []).concat(b)));

      data = {
        vendors: raw.vendors,
        slotMap: new Map(raw.slots.map((s) => [`${s.vendorId}|${s.asetId}|${s.tanggal}`, s.terisi])),
        blocksByDate
      };
    } catch (err) {
      console.error(err);
      if (id !== token) return;
      errorBox.textContent = "Gagal memuat kalender gabungan.";
    }

    draw();
  }

  container.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      const date = new Date(year, month + Number(nav.dataset.nav), 1);
      year = date.getFullYear();
      month = date.getMonth();
      selected = "";
      load();
      return;
    }

    const cell = event.target.closest("[data-date]");
    if (!cell) return;
    selected = cell.dataset.date;
    draw();
  });

  draw();
  load();
}
