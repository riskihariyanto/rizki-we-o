import { registerVendor, authMessage, refreshSession } from "../auth.js";
import { db, doc, writeBatch } from "../firebase.js";
import { CATEGORIES, MAX_SLOT, REGIONS } from "../constants.js";

function slotOptions() {
  return Array.from({ length: MAX_SLOT }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
}

function regionSuggestions() {
  return REGIONS.map((r) => `<option value="${r.label}"></option>`).join("");
}

function normalizeRegion(raw) {
  return String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
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
  <section class="stack auth-page register-page">
    <div class="auth-brand">
      <img src="./icons/logo-full-512.png" alt="WO Vendor Portal" class="auth-logo">
      <span class="auth-kicker">Vendor Portal</span>
    </div>

    <header class="auth-header">
      <p class="eyebrow">Bergabung sebagai mitra</p>
      <h1>Bangun pengalaman wedding yang berkesan.</h1>
      <p class="muted">Lengkapi profil bisnis Anda untuk mulai mengelola jadwal, layanan, dan pembayaran dalam satu portal.</p>
    </header>

    <form class="card stack auth-form register-form" novalidate>
      <section class="stack register-section">
        <div>
          <p class="eyebrow">01 · Profil bisnis</p>
          <h2>Informasi vendor</h2>
          <p class="muted">Informasi ini membantu klien mengenali bisnis Anda.</p>
        </div>
        <label class="field"><span>Nama vendor</span><input type="text" name="namaVendor" maxlength="80" autocomplete="organization" placeholder="Nama bisnis atau brand" required></label>
        <label class="field"><span>Nomor WhatsApp</span><input type="tel" name="noWa" inputmode="tel" autocomplete="tel" placeholder="08xxxxxxxxxx" required></label>
        <label class="field"><span>Wilayah domisili</span><input type="text" name="wilayah" list="wilayah-list" maxlength="40" autocomplete="off" placeholder="Contoh: Tangerang, Bekasi, Bogor" required><datalist id="wilayah-list">${regionSuggestions()}</datalist></label>
        <label class="field"><span>Alamat</span><input type="text" name="alamat" maxlength="200" autocomplete="street-address" placeholder="Alamat usaha atau domisili" required></label>
      </section>

      <section class="stack register-section">
        <div>
          <p class="eyebrow">02 · Pembayaran</p>
          <h2>Rekening pembayaran</h2>
          <p class="muted">Dicantumkan pada invoice agar klien mengetahui tujuan transfer. Bagian ini boleh dilengkapi nanti.</p>
        </div>
        <label class="field"><span>Nama bank</span><input type="text" name="namaBank" maxlength="40" autocomplete="off" placeholder="Contoh: BCA"></label>
        <label class="field"><span>Nomor rekening</span><input type="text" name="noRekening" inputmode="numeric" maxlength="30" autocomplete="off" placeholder="Nomor rekening"></label>
        <label class="field"><span>Atas nama</span><input type="text" name="atasNama" maxlength="80" autocomplete="off" placeholder="Nama pemilik rekening"></label>
      </section>

      <section class="stack register-section">
        <div>
          <p class="eyebrow">03 · Akses portal</p>
          <h2>Buat akun</h2>
        </div>
        <label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="nama@email.com" required></label>
        <label class="field"><span>Kata sandi</span><input type="password" name="password" autocomplete="new-password" minlength="6" placeholder="Minimal 6 karakter" required></label>
      </section>

      <section class="stack register-section">
        <div>
          <p class="eyebrow">04 · Layanan</p>
          <h2>Aset yang dimiliki</h2>
          <p class="muted">Pilih minimal satu kategori layanan. Anda dapat mengisi spesifikasi dan kapasitasnya setelah memilih.</p>
        </div>
        <div class="register-assets">
          ${CATEGORIES.map(assetBlock).join("")}
        </div>
      </section>

      <p class="muted register-note">Akun vendor akan aktif setelah ditinjau dan disetujui oleh pemilik WO.</p>
      <p class="error" data-error role="alert"></p>
      <button class="btn auth-submit" type="submit">Buat akun vendor</button>
    </form>

    <p class="center muted auth-footer">Sudah punya akun? <a href="#/login">Masuk</a></p>
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
    wilayah: normalizeRegion(value("wilayah")),
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
  if (!/^[\p{L}][\p{L}\s.'-]{1,39}$/u.test(data.wilayah)) return "Isi wilayah domisili dengan nama kota atau kabupaten.";
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