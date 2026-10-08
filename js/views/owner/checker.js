import { findAvailable } from "../../services/availability.js";
import { listVendorsByStatus } from "../../services/vendors.js";
import { CATEGORIES, REGIONS, ALL_REGIONS } from "../../constants.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function todayKey() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function normalizeRegion(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function regionLabel(value) {
  const key = normalizeRegion(value);
  if (!key) return "";
  const known = REGIONS.find((r) => r.id === key);
  if (known) return known.label;
  return key.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function extractRegions(vendors) {
  const keys = [...new Set(vendors.map((v) => normalizeRegion(v.wilayah)).filter(Boolean))];
  return keys.sort((a, b) => regionLabel(a).localeCompare(regionLabel(b)));
}

function fillRegionSelect(select, regions) {
  const current = select.value;
  const options = [new Option("Semua Wilayah", ALL_REGIONS)];
  regions.forEach((key) => options.push(new Option(regionLabel(key), key)));
  select.replaceChildren(...options);
  select.value = regions.includes(current) ? current : ALL_REGIONS;
}

function filterByRegion(items, region) {
  if (region === ALL_REGIONS) return items;
  return items.filter((item) => normalizeRegion(item.wilayah) === region);
}

function formTemplate() {
  const options = CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");

  return `
    <div class="checker-fields">
      <label class="field">
        <span>Tanggal acara</span>
        <input type="date" name="tanggal" required>
      </label>
      <label class="field">
        <span>Kategori</span>
        <select name="kategori">${options}</select>
      </label>
      <label class="field checker-region">
        <span>Wilayah vendor</span>
        <select name="wilayah"><option value="${ALL_REGIONS}">Semua Wilayah</option></select>
      </label>
    </div>
    <button class="btn" type="submit">Cek Ketersediaan</button>
  `;
}

function resultCard(item, onPick) {
  const card = el("article", "card stack checker-result");
  const closed = item.closed > 0 ? ` · ${item.closed} ditutup` : "";
  const region = regionLabel(item.wilayah);
  const detail = item.spesifikasi || "Tanpa spesifikasi";

  const meta = el("div", "checker-result-meta");
  meta.append(
    el("p", "eyebrow", "AVAILABLE"),
    el("p", "muted", region ? `${region} · ${detail}` : detail)
  );

  const capacity = el("div", "checker-capacity");
  capacity.append(
    el("strong", "", `${item.free} slot`),
    el("span", "muted", `dari ${item.capacity}${closed}`)
  );

  card.append(
    el("h3", "", item.namaVendor),
    meta,
    capacity
  );

  if (onPick) {
    const pick = el("button", "btn ghost inline checker-pick", "Pilih vendor");
    pick.type = "button";
    pick.addEventListener("click", () => onPick(item));
    card.append(pick);
  }

  return card;
}

export function renderChecker(container, { onPick, tanggal: defaultDate } = {}) {
  container.replaceChildren();

  const intro = el("div", "stack checker-intro");
  intro.append(
    el("p", "eyebrow", "VENDOR CHECKER"),
    el("h2", "", "Cek Ketersediaan"),
    el("p", "muted", "Temukan vendor dengan slot yang masih tersedia untuk tanggal acara.")
  );

  const form = el("form", "card stack checker-form");
  const results = el("div", "stack checker-results");
  const errorBox = el("p", "error");

  form.noValidate = true;
  form.innerHTML = formTemplate();
  form.elements.tanggal.value = defaultDate || todayKey();

  container.append(intro, form, errorBox, results);

  let fetched = null;

  listVendorsByStatus("aktif")
    .then((vendors) => fillRegionSelect(form.elements.wilayah, extractRegions(vendors)))
    .catch((err) => console.error(err));

  function showResults() {
    results.replaceChildren();
    if (!fetched) return;

    const region = form.elements.wilayah.value;
    const items = filterByRegion(fetched, region);

    if (items.length === 0) {
      const scope = region === ALL_REGIONS ? "" : ` di ${regionLabel(region)}`;
      results.append(el("p", "muted", `Tidak ada vendor dengan slot kosong${scope} pada tanggal ini.`));
      return;
    }

    items.forEach((item) => results.append(resultCard(item, onPick)));
  }

  form.elements.wilayah.addEventListener("change", showResults);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";

    const tanggal = form.elements.tanggal.value;
    const kategori = form.elements.kategori.value;
    const submit = form.querySelector('button[type="submit"]');

    if (!tanggal) {
      errorBox.textContent = "Pilih tanggal acara.";
      return;
    }

    submit.disabled = true;
    results.replaceChildren(el("p", "loading", "Mencari..."));

    try {
      fetched = await findAvailable({ tanggal, kategori });
      showResults();
    } catch (err) {
      console.error(err);
      fetched = null;
      results.replaceChildren();
      errorBox.textContent = "Gagal mengecek ketersediaan.";
    } finally {
      submit.disabled = false;
    }
  });
}