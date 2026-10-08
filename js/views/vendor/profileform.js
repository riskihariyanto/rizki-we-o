import { db, doc, updateDoc } from "../../firebase.js";
import { REGIONS } from "../../constants.js";

function regionSuggestions() {
  return REGIONS.map((r) => `<option value="${r.label}"></option>`).join("");
}

function normalizeRegion(raw) {
  return String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function regionDisplay(raw) {
  const key = normalizeRegion(raw);
  const known = REGIONS.find((r) => r.id === key);
  if (known) return known.label;
  return key.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

const TEMPLATE = `
  <div class="stack profile-form-intro">
    <p class="muted">Data ini dicantumkan pada kop kuitansi dan invoice PDF.</p>
  </div>
  <div class="stack profile-form-fields">
    <label class="field"><span>Nomor WhatsApp</span><input type="tel" name="noWa" inputmode="tel" required></label>
    <label class="field"><span>Wilayah domisili</span><input type="text" name="wilayah" list="wilayah-list" maxlength="40" autocomplete="off" placeholder="Contoh: Tangerang, Bekasi, Bogor" required><datalist id="wilayah-list">${regionSuggestions()}</datalist></label>
    <label class="field"><span>Alamat</span><input type="text" name="alamat" maxlength="200" required></label>
    <label class="field"><span>Email bisnis</span><input type="email" name="email" autocomplete="email"></label>
    <label class="field"><span>Nama bank</span><input type="text" name="namaBank" maxlength="40" placeholder="Contoh: BCA"></label>
    <label class="field"><span>Nomor rekening</span><input type="text" name="noRekening" inputmode="numeric" maxlength="30" autocomplete="off"></label>
    <label class="field"><span>Atas nama</span><input type="text" name="atasNama" maxlength="80"></label>
  </div>
  <p class="error" data-error></p>
  <p class="muted" data-info></p>
  <button class="btn" type="submit">Simpan Profil</button>
`;

const FIELDS = ["noWa", "wilayah", "alamat", "email", "namaBank", "noRekening", "atasNama"];

function problemOf(data) {
  if (!data.noWa || !data.alamat) return "Nomor WhatsApp dan alamat wajib diisi.";
  if (!/^[\p{L}][\p{L}\s.'-]{1,39}$/u.test(data.wilayah)) return "Isi wilayah domisili dengan nama kota atau kabupaten.";
  if (Boolean(data.namaBank) !== Boolean(data.noRekening)) {
    return "Isi nama bank dan nomor rekening bersama-sama, atau kosongkan keduanya.";
  }
  return "";
}

export function renderProfileForm(container, { vendorId, vendor, email, onSaved }) {
  container.replaceChildren();

  const card = document.createElement("details");
  const form = document.createElement("form");
  const current = { email, ...vendor };

  card.className = "card profile-form-card";
  form.className = "stack";
  form.noValidate = true;
  form.innerHTML = TEMPLATE;

  FIELDS.forEach((name) => {
    form.elements[name].value = name === "wilayah" ? regionDisplay(current[name]) : current[name] || "";
  });

  const errorBox = form.querySelector("[data-error]");
  const infoBox = form.querySelector("[data-info]");
  const submit = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";
    infoBox.textContent = "";

    const data = Object.fromEntries(
      FIELDS.map((name) => [name, form.elements[name].value.trim()])
    );
    data.wilayah = normalizeRegion(data.wilayah);
    const problem = problemOf(data);

    if (problem) {
      errorBox.textContent = problem;
      return;
    }

    submit.disabled = true;
    submit.textContent = "Menyimpan...";

    try {
      await updateDoc(doc(db, "vendors", vendorId), data);
      onSaved(data);
      infoBox.textContent = "Profil tersimpan.";
    } catch (err) {
      console.error(err);
      errorBox.textContent = "Gagal menyimpan profil. Coba lagi.";
    } finally {
      submit.disabled = false;
      submit.textContent = "Simpan Profil";
    }
  });

  const title = document.createElement("summary");
  title.textContent = "Profil & Rekening";
  card.append(title, form);
  container.append(card);
}