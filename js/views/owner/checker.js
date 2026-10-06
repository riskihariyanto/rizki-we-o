import { findAvailable } from "../../services/availability.js";
import { CATEGORIES } from "../../constants.js";

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

function formTemplate() {
  const options = CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");

  return `
    <label class="field"><span>Tanggal acara</span><input type="date" name="tanggal" required></label>
    <label class="field"><span>Kategori</span><select name="kategori">${options}</select></label>
    <button class="btn" type="submit">Cek Ketersediaan</button>
  `;
}

function resultCard(item, onPick) {
  const card = el("article", "card stack");
  const closed = item.closed > 0 ? ` · ${item.closed} ditutup` : "";

  card.append(
    el("h3", "", item.namaVendor),
    el("p", "muted", item.spesifikasi || "Tanpa spesifikasi"),
    el("p", "", `Sisa ${item.free} dari ${item.capacity} slot${closed}`)
  );

  if (onPick) {
    const pick = el("button", "btn ghost inline", "Pilih");
    pick.type = "button";
    pick.addEventListener("click", () => onPick(item));
    card.append(pick);
  }

  return card;
}

export function renderChecker(container, { onPick, tanggal: defaultDate } = {}) {
  container.replaceChildren();

  const form = el("form", "card stack");
  const results = el("div", "stack");
  const errorBox = el("p", "error");

  form.noValidate = true;
  form.innerHTML = formTemplate();
  form.elements.tanggal.value = defaultDate || todayKey();

  container.append(el("h2", "", "Cek Ketersediaan"), form, errorBox, results);

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
      const items = await findAvailable({ tanggal, kategori });
      results.replaceChildren();
      if (items.length === 0) {
        results.append(el("p", "muted", "Tidak ada vendor dengan slot kosong pada tanggal ini."));
        return;
      }
      items.forEach((item) => results.append(resultCard(item, onPick)));
    } catch (err) {
      console.error(err);
      results.replaceChildren();
      errorBox.textContent = "Gagal mengecek ketersediaan.";
    } finally {
      submit.disabled = false;
    }
  });
}
