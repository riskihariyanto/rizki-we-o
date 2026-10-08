import { addBlock, removeBlock, listBlocksByMonth, ALL_ASSETS } from "../../services/blocks.js";
import { CATEGORIES, MAX_SLOT } from "../../constants.js";

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const scopeLabel = (id) => (id === ALL_ASSETS ? "Semua aset" : LABEL[id] || id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function blockText(block) {
  const scope = scopeLabel(block.asetId);
  const slots = block.slotDitutup === "semua" ? "ditutup penuh" : `${block.slotDitutup} slot ditutup`;
  return block.alasan ? `${scope} · ${slots} · ${block.alasan}` : `${scope} · ${slots}`;
}

function formTemplate(aset) {
  const scopes = [`<option value="${ALL_ASSETS}">Semua aset</option>`]
    .concat(aset.map((a) => `<option value="${a.id}">${scopeLabel(a.id)}</option>`))
    .join("");

  const slots = ['<option value="semua">Tutup penuh</option>']
    .concat(Array.from({ length: MAX_SLOT }, (_, i) => `<option value="${i + 1}">${i + 1} slot</option>`))
    .join("");

  return `
    <label class="field"><span>Aset</span><select name="asetId">${scopes}</select></label>
    <label class="field"><span>Jumlah yang ditutup</span><select name="slotDitutup">${slots}</select></label>
    <label class="field"><span>Alasan</span><input type="text" name="alasan" maxlength="120" placeholder="Contoh: libur, perawatan alat"></label>
    <p class="error" data-error></p>
    <button class="btn" type="submit">Simpan Penutupan</button>
  `;
}

export function renderBlockForm(container, { vendorId, aset, tanggal, onChanged }) {
  container.replaceChildren();

  const root = el("section", "stack block-zone");
  root.setAttribute("aria-label", "Penutupan slot");
  const list = el("div", "stack");
  const intro = el("div", "section-heading");
  intro.append(el("div", "eyebrow", "AVAILABILITY CONTROL"), el("h3", "section-title", "Tutup slot pada tanggal ini"), el("p", "muted", "Gunakan penutupan untuk membatasi seluruh aset atau sebagian kapasitas. Booking yang sudah ada tetap aman."));
  const toggle = el("button", "btn warn", "Tutup Slot Tanggal Ini");
  const panel = el("div", "collapse");
  const inner = el("div", "collapse-inner stack");
  const form = el("form", "stack");

  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  panel.inert = true;
  list.hidden = true;
  form.noValidate = true;
  form.innerHTML = formTemplate(aset);

  inner.append(form);
  panel.append(inner);
  root.append(intro, list, toggle, panel);
  container.append(root);

  function setOpen(open) {
    panel.classList.toggle("open", open);
    panel.inert = !open;
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Batal Menutup Tanggal" : "Tutup Slot Tanggal Ini";
  }

  toggle.addEventListener("click", () => setOpen(!panel.classList.contains("open")));

  async function handleRemove(blockId, button) {
    button.disabled = true;
    try {
      await removeBlock(blockId);
      onChanged();
    } catch (err) {
      console.error(err);
      button.disabled = false;
      list.append(el("p", "error", "Gagal membuka penutupan."));
    }
  }

  async function loadBlocks() {
    try {
      const month = await listBlocksByMonth(vendorId, tanggal.slice(0, 7));
      const blocks = month.filter((b) => b.tanggal === tanggal);
      list.hidden = blocks.length === 0;
      blocks.forEach((block) => {
        const row = el("div", "row between block-row");
        const open = el("button", "btn ghost inline", "Buka");
        open.type = "button";
        open.addEventListener("click", () => handleRemove(block.id, open));
        const copy = el("div", "stack compact");
        copy.append(el("strong", "block-title", scopeLabel(block.asetId)), el("span", "muted", block.slotDitutup === "semua" ? "Kapasitas ditutup penuh" : `${block.slotDitutup} slot ditutup`), ...(block.alasan ? [el("span", "muted", block.alasan)] : []));
        row.append(copy, open);
        list.append(row);
      });
    } catch (err) {
      console.error(err);
      list.hidden = false;
      list.append(el("p", "error", "Gagal memuat penutupan."));
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const errorBox = form.querySelector("[data-error]");
    const submit = form.querySelector('button[type="submit"]');
    const scope = scopeLabel(form.elements.asetId.value);
    const slots = form.elements.slotDitutup.value === "semua" ? "ditutup penuh" : `${form.elements.slotDitutup.value} slot ditutup`;

    errorBox.textContent = "";
    if (!window.confirm(`Tutup ${scope} (${slots}) pada tanggal ini? Tanggal tidak bisa dibooking sampai penutupan dibuka kembali. Booking yang sudah ada tidak dibatalkan.`)) return;

    submit.disabled = true;

    try {
      await addBlock({
        vendorId,
        asetId: form.elements.asetId.value,
        tanggal,
        slotDitutup: form.elements.slotDitutup.value,
        alasan: form.elements.alasan.value
      });
      onChanged();
    } catch (err) {
      console.error(err);
      errorBox.textContent = err.code === "permission-denied" ? "Akses ditolak oleh aturan keamanan." : "Gagal menyimpan penutupan.";
      submit.disabled = false;
    }
  });

  loadBlocks();
}