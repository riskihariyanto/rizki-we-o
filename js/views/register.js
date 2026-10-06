import { registerVendor, authMessage, refreshSession } from "../auth.js";
import { db, doc, writeBatch } from "../firebase.js";
import { CATEGORIES, MAX_SLOT } from "../constants.js";

function slotOptions() {
  return Array.from({ length: MAX_SLOT }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
}

function assetBlock(category) {
  return `
    <div class="stack">
      <label class="check">
        <input type="checkbox" name="kategori" value="${category.id}">
        <span>${category.label}</span>
      </label>
      <div class="stack" data-detail="${category.id}" hidden>
        <label class="field">
          <span>Spesifikasi ${category.label}</span>
          <input type="text" name="spek-${category.id}" maxlength="200" placeholder="Contoh: ukuran, jumlah, merek">
        </label>
        <label class="field">
          <span>Kapasitas acara per hari</span>
          <select name="kap-${category.id}">${slotOptions()}</select>
        </label>
      </div>
    </div>
  `;
}

const TEMPLATE = `
  <section class="stack">
    <header>
      <h1>Daftar Vendor</h1>
      <p class="muted">Akun akan aktif setelah disetujui pemilik WO.</p>
    </header>
    <form class="card stack" novalidate>
      <label class="field"><span>Nama vendor</span><input type="text" name="namaVendor" maxlength="80" required></label>
      <label class="field"><span>Nomor WhatsApp</span><input type="tel" name="noWa" inputmode="tel" placeholder="08xxxxxxxxxx" required></label>
      <label class="field"><span>Alamat</span><input type="text" name="alamat" maxlength="200" required></label>
      <h2>Rekening pembayaran</h2>
      <p class="muted">Dicantumkan pada invoice agar klien tahu tujuan transfer. Boleh diisi nanti.</p>
      <label class="field"><span>Nama bank</span><input type="text" name="namaBank" maxlength="40" placeholder="Contoh: BCA"></label>
      <label class="field"><span>Nomor rekening</span><input type="text" name="noRekening" inputmode="numeric" maxlength="30" autocomplete="off"></label>
      <label class="field"><span>Atas nama</span><input type="text" name="atasNama" maxlength="80"></label>
      <h2>Akun</h2>
      <label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" required></label>
      <label class="field"><span>Kata sandi</span><input type="password" name="password" autocomplete="new-password" minlength="6" required></label>
      <h2>Aset yang dimiliki</h2>
      ${CATEGORIES.map(assetBlock).join("")}
      <p class="error" data-error></p>
      <button class="btn" type="submit">Daftar</button>
    </form>
    <p class="center muted">Sudah punya akun? <a href="#/login">Masuk</a></p>
  </section>
`;

function readForm(form) {
  const value = (name) => form.elements[name].value.trim();
  const selected = CATEGORIES.filter((c) =>
    form.querySelector(`input[name="kategori"][value="${c.id}"]`).checked
  );

  return {
    email: value("email"),
    password: form.elements.password.value,
    namaVendor: value("namaVendor"),
    noWa: value("noWa"),
    alamat: value("alamat"),
    namaBank: value("namaBank"),
    noRekening: value("noRekening"),
    atasNama: value("atasNama"),
    aset: selected.map((c) => ({
      id: c.id,
      spesifikasi: value(`spek-${c.id}`),
      kapasitasPerHari: Number(form.elements[`kap-${c.id}`].value)
    }))
  };
}

function validate(data) {
  if (!data.namaVendor || !data.noWa || !data.alamat || !data.email || !data.password) {
    return "Semua kolom wajib diisi.";
  }
  if (Boolean(data.namaBank) !== Boolean(data.noRekening)) {
    return "Isi nama bank dan nomor rekening bersama-sama, atau kosongkan keduanya.";
  }
  if (data.aset.length === 0) return "Pilih minimal satu aset.";
  return "";
}

async function saveAssets(uid, aset) {
  const batch = writeBatch(db);
  aset.forEach(({ id, spesifikasi, kapasitasPerHari }) => {
    batch.set(doc(db, "vendors", uid, "aset", id), { kategori: id, spesifikasi, kapasitasPerHari });
  });
  batch.update(doc(db, "vendors", uid), { kategori: aset.map((a) => a.id) });
  await batch.commit();
}

export function render(root) {
  root.innerHTML = TEMPLATE;

  const form = root.querySelector("form");
  const errorBox = root.querySelector("[data-error]");
  const submit = form.querySelector('button[type="submit"]');

  form.addEventListener("change", (event) => {
    if (event.target.name !== "kategori") return;
    form.querySelector(`[data-detail="${event.target.value}"]`).hidden = !event.target.checked;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";

    const data = readForm(form);
    const problem = validate(data);
    if (problem) {
      errorBox.textContent = problem;
      return;
    }

    submit.disabled = true;
    submit.textContent = "Memproses...";

    try {
      const uid = await registerVendor(data);
      try {
        await saveAssets(uid, data.aset);
      } catch (assetErr) {
        console.error(assetErr);
      }
      await refreshSession();
    } catch (err) {
      errorBox.textContent = authMessage(err);
      submit.disabled = false;
      submit.textContent = "Daftar";
    }
  });
}