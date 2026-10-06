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

  const details = el("details", "card stack");
  const list = el("div", "stack");
  const form = el("form", "stack");
  form.noValidate = true;
  form.innerHTML = formTemplate(aset);

  details.append(el("summary", "", "Tutup Tanggal"), list, form);
  container.append(details);

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
      month
        .filter((b) => b.tanggal === tanggal)
        .forEach((block) => {
          const row = el("div", "row between");
          const open = el("button", "btn ghost inline", "Buka");
          open.type = "button";
          open.addEventListener("click", () => handleRemove(block.id, open));
          row.append(el("span", "", blockText(block)), open);
          list.append(row);
        });
    } catch (err) {
      console.error(err);
      list.append(el("p", "error", "Gagal memuat penutupan."));
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const errorBox = form.querySelector("[data-error]");
    const submit = form.querySelector('button[type="submit"]');

    errorBox.textContent = "";
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
