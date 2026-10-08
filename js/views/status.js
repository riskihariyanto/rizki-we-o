import { logout } from "../auth.js";

const STATES = {
  menunggu: {
    badge: "Menunggu persetujuan",
    tone: "",
    text: "Pendaftaran kamu sudah diterima. Pemilik WO akan meninjau dan mengaktifkan akun kamu."
  },
  ditolak: {
    badge: "Ditolak",
    tone: "bad",
    text: "Pendaftaran kamu belum dapat disetujui. Hubungi pemilik WO untuk informasi lebih lanjut."
  },
  nonaktif: {
    badge: "Nonaktif",
    tone: "bad",
    text: "Akun kamu sedang dinonaktifkan. Hubungi pemilik WO untuk mengaktifkannya kembali."
  },
  tidak_dikenal: {
    badge: "Akun belum terdaftar",
    tone: "bad",
    text: "Akun ini belum terhubung ke peran apa pun. Hubungi pemilik WO."
  }
};

function resolveState(profile) {
  if (!profile.role) return STATES.tidak_dikenal;
  const status = profile.vendor ? profile.vendor.status : "menunggu";
  return STATES[status] || STATES.menunggu;
}

const TEMPLATE = `
  <section class="stack">
    <header>
      <h1>Status Akun</h1>
      <p class="muted" data-email></p>
    </header>
    <div class="card stack">
      <div><span class="badge" data-badge></span></div>
      <p data-text></p>
    </div>
    <button class="btn ghost" type="button" data-logout>Keluar</button>
  </section>
`;

export function render(root, { profile }) {
  const state = resolveState(profile);

  root.innerHTML = TEMPLATE;
  root.querySelector("[data-email]").textContent = profile.email || "";
  root.querySelector("[data-text]").textContent = state.text;

  const badge = root.querySelector("[data-badge]");
  badge.textContent = state.badge;
  if (state.tone) badge.classList.add(state.tone);

  root.querySelector("[data-logout]").addEventListener("click", () => logout());
}
