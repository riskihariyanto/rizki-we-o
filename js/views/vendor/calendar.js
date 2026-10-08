import { listSlotsByMonth } from "../../services/bookings.js";
import { listBlocksByMonth, ALL_ASSETS } from "../../services/blocks.js";
import { freeSlots } from "../../lib/availability.js";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const TEMPLATE = `
  <div class="stack calendar-shell">
    <div class="calendar-heading">
      <div>
        <p class="eyebrow">BOOKING CALENDAR</p>
        <h2 data-title></h2>
      </div>
      <div class="calendar-nav-actions" role="group" aria-label="Navigasi bulan">
        <button class="btn ghost inline" type="button" data-nav="-1" aria-label="Bulan sebelumnya">&lsaquo;</button>
        <button class="btn ghost inline" type="button" data-nav="1" aria-label="Bulan berikutnya">&rsaquo;</button>
      </div>
    </div>
    <div class="cal-grid calendar-grid" data-grid></div>
    <div class="cal-legend calendar-legend muted" aria-label="Keterangan status">
      <span><span class="dot kosong"></span>Kosong</span>
      <span><span class="dot sebagian"></span>Terisi sebagian</span>
      <span><span class="dot penuh"></span>Penuh/ditutup</span>
    </div>
    <div class="cal-summary calendar-summary" data-summary></div>
    <p class="error" data-error role="alert"></p>
  </div>
`;

const pad = (n) => String(n).padStart(2, "0");

function dayDetail(aset, tanggal, slotMap, blocks) {
  return aset.map((item) => {
    const filled = slotMap.get(`${item.id}|${tanggal}`) || 0;
    const relevant = blocks.filter(
      (b) => b.tanggal === tanggal && (b.asetId === item.id || b.asetId === ALL_ASSETS)
    );
    const { closed, free, blocked } = freeSlots(item.kapasitasPerHari, filled, relevant);
    return { asetId: item.id, kategori: item.kategori, capacity: item.kapasitasPerHari, filled, closed, free, blocked };
  });
}

function dayStatus(details) {
  if (details.length === 0) return "kosong";
  if (details.every((d) => d.free === 0)) return "penuh";
  if (details.some((d) => d.filled > 0 || d.closed > 0)) return "sebagian";
  return "kosong";
}

export function renderCalendar(container, { vendorId, aset, onSelect }) {
  container.innerHTML = TEMPLATE;

  const title = container.querySelector("[data-title]");
  const grid = container.querySelector("[data-grid]");
  const summary = container.querySelector("[data-summary]");
  const errorBox = container.querySelector("[data-error]");

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  let year = now.getFullYear();
  let month = now.getMonth();
  let selected = "";
  let slotMap = new Map();
  let blocks = [];
  let token = 0;

  function draw() {
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const cells = Array(offset).fill("<span></span>");
    const stats = { acara: 0, penuh: 0, kosong: 0 };

    for (let day = 1; day <= total; day += 1) {
      const tanggal = `${year}-${pad(month + 1)}-${pad(day)}`;
      const details = dayDetail(aset, tanggal, slotMap, blocks);
      const status = dayStatus(details);
      stats.acara += details.reduce((sum, d) => sum + d.filled, 0);
      if (status === "penuh") stats.penuh += 1;
      if (status === "kosong") stats.kosong += 1;
      const extra = (tanggal === todayKey ? " today" : "") + (tanggal === selected ? " selected" : "");
      cells.push(`<button type="button" class="cal-day ${status}${extra}" data-date="${tanggal}" aria-label="${tanggal}, ${status}" aria-pressed="${tanggal === selected}">${day}</button>`);
    }

    title.textContent = `${MONTHS[month]} ${year}`;
    summary.innerHTML = [
      [stats.acara, "Acara Terjadwal"],
      [stats.penuh, "Hari Penuh/Ditutup"],
      [stats.kosong, "Hari Masih Kosong"]
    ].map(([value, label]) => `<div class="cal-stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
    grid.innerHTML = WEEKDAYS.map((w) => `<span class="cal-head">${w}</span>`).join("") + cells.join("");
  }

  async function load() {
    const id = ++token;
    const key = `${year}-${pad(month + 1)}`;
    errorBox.textContent = "";

    try {
      const [slots, monthBlocks] = await Promise.all([
        listSlotsByMonth(vendorId, key),
        listBlocksByMonth(vendorId, key)
      ]);
      if (id !== token) return;
      slotMap = new Map(slots.map((s) => [`${s.asetId}|${s.tanggal}`, s.terisi]));
      blocks = monthBlocks;
    } catch (err) {
      console.error(err);
      if (id !== token) return;
      errorBox.textContent = "Gagal memuat kalender.";
    }

    draw();
  }

  container.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      const date = new Date(year, month + Number(nav.dataset.nav), 1);
      year = date.getFullYear();
      month = date.getMonth();
      load();
      return;
    }

    const cell = event.target.closest("[data-date]");
    if (!cell) return;
    selected = cell.dataset.date;
    draw();
    onSelect(selected, dayDetail(aset, selected, slotMap, blocks));
  });

  draw();
  load();

  return { reload: load };
}