import { db, doc, updateDoc } from "../../firebase.js";

const TEMPLATE = `
  <p class="muted">Data ini dicantumkan pada kop kuitansi dan invoice PDF.</p>
  <label class="field"><span>Nomor WhatsApp</span><input type="tel" name="noWa" inputmode="tel" required></label>
  <label class="field"><span>Alamat</span><input type="text" name="alamat" maxlength="200" required></label>
  <label class="field"><span>Email bisnis</span><input type="email" name="email" autocomplete="email"></label>
  <label class="field"><span>Nama bank</span><input type="text" name="namaBank" maxlength="40" placeholder="Contoh: BCA"></label>
  <label class="field"><span>Nomor rekening</span><input type="text" name="noRekening" inputmode="numeric" maxlength="30" autocomplete="off"></label>
  <label class="field"><span>Atas nama</span><input type="text" name="atasNama" maxlength="80"></label>
  <p class="error" data-error></p>
  <p class="muted" data-info></p>
  <button class="btn" type="submit">Simpan Profil</button>
`;

const FIELDS = ["noWa", "alamat", "email", "namaBank", "noRekening", "atasNama"];

function problemOf(data) {
  if (!data.noWa || !data.alamat) return "Nomor WhatsApp dan alamat wajib diisi.";
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

  card.className = "card";
  form.className = "stack";
  form.noValidate = true;
  form.innerHTML = TEMPLATE;
  FIELDS.forEach((name) => {
    form.elements[name].value = current[name] || "";
  });

  const errorBox = form.querySelector("[data-error]");
  const infoBox = form.querySelector("[data-info]");
  const submit = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";
    infoBox.textContent = "";

    const data = Object.fromEntries(FIELDS.map((name) => [name, form.elements[name].value.trim()]));
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