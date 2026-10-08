import { logout } from "../auth.js";
import { whatsappLink } from "../lib/receipt.js";
import { listAssets } from "../services/assets.js";
import { renderCalendar } from "./vendor/calendar.js";
import { renderDayPanel } from "./vendor/dayPanel.js";
import { renderProfileForm } from "./vendor/profileform.js";

const SWAP_MS = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;

const HELP_URL = whatsappLink(
  "081383179209",
  "Halo Kak Riski, saya admin dari vendor di Portal WO. Saya butuh bantuan terkait penggunaan aplikasi pada akun saya. Mohon infonya ya kak. Terima kasih!"
);

const TEMPLATE = `
  <section class="screen stack vendor-dashboard" data-screen="calendar">
    <header class="topbar">
      <div class="topbar-id">
        <h1 class="topbar-name" data-name></h1>
        <p class="topbar-mail muted" data-email></p>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost icon" type="button" data-profile-toggle aria-label="Profil &amp; Rekening" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4"></circle>
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"></path>
          </svg>
        </button>
        <button class="btn ghost inline" type="button" data-logout>Keluar</button>
      </div>
    </header>
    <div class="section-heading">
      <div>
        <p class="eyebrow">Availability</p>
        <h2>Kalender Booking</h2>
      </div>
      <span class="section-note">Pilih tanggal untuk detail</span>
    </div>
    <div class="card calendar-shell" data-calendar></div>
    <a class="btn accent whatsapp-help" href="${HELP_URL}" target="_blank" rel="noopener noreferrer">
      <svg class="btn-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"></path>
        <path d="M9 9.2c.2 2.3 2.5 4.6 5 5.4l1.4-1.4-1.9-1-.9.8c-.8-.4-1.6-1.2-2-2l.8-.9-1-1.9z" fill="currentColor" stroke="none"></path>
      </svg>
      <span>Hubungi Bantuan WhatsApp</span>
    </a>
  </section>
  <section class="screen screen-detail stack" data-screen="detail" hidden>
    <div class="screen-bar">
      <button class="btn ghost inline" type="button" data-back>&larr; Kembali ke Kalender</button>
      <span class="screen-bar-label">Booking detail</span>
    </div>
    <div data-day></div>
  </section>
  <section class="screen screen-profile" data-screen="profile" hidden>
    <div class="profile-panel" data-panel>
      <div class="profile-panel-head">
        <div>
          <p class="eyebrow">Account</p>
          <h2>Profil &amp; Rekening</h2>
        </div>
        <button class="btn ghost inline" type="button" data-profile-close>Tutup</button>
      </div>
      <div data-profile></div>
    </div>
  </section>
`;

function createSwitcher(calendarScreen, detailScreen) {
  let current = "calendar";
  let busy = false;
  let savedScroll = 0;

  function swap(from, to, forward, scrollTo) {
    const exit = forward ? "shift-left" : "shift-right";
    const enter = forward ? "shift-right" : "shift-left";

    busy = true;
    from.classList.add("is-out", exit);

    setTimeout(() => {
      from.hidden = true;
      from.classList.remove("is-out", exit);
      to.classList.add("is-in-start", enter);
      to.hidden = false;
      window.scrollTo(0, scrollTo);
      to.getBoundingClientRect();
      to.classList.remove("is-in-start", enter);
      busy = false;
    }, SWAP_MS);
  }

  return {
    showDetail() {
      if (current === "detail" || busy) return;
      current = "detail";
      savedScroll = window.scrollY;
      swap(calendarScreen, detailScreen, true, 0);
    },
    showCalendar() {
      if (current === "calendar" || busy) return;
      current = "calendar";
      swap(detailScreen, calendarScreen, false, savedScroll);
    }
  };
}

function createProfileView(root, { screen, suspended, toggle, closeButton }) {
  let open = false;
  let busy = false;
  let savedScroll = 0;

  function apply(next) {
    open = next;
    suspended.forEach((node) => node.toggleAttribute("data-suspended", next));
    screen.hidden = !next;
    toggle.setAttribute("aria-expanded", String(next));
    window.scrollTo(0, next ? 0 : savedScroll);
    (next ? closeButton : toggle).focus({ preventScroll: true });
  }

  function move(next) {
    if (busy || next === open) return;
    busy = true;
    if (next) savedScroll = window.scrollY;
    root.classList.add("is-switching");

    setTimeout(() => {
      apply(next);
      root.getBoundingClientRect();
      root.classList.remove("is-switching");
      setTimeout(() => {
        busy = false;
      }, SWAP_MS);
    }, SWAP_MS);
  }

  screen.addEventListener("keydown", (event) => {
    if (event.key === "Escape") move(false);
  });

  return {
    show: () => move(true),
    hide: () => move(false),
    toggle: () => move(!open)
  };
}

export async function render(root, { profile }) {
  root.classList.remove("is-switching");
  root.innerHTML = TEMPLATE;
  root.querySelector("[data-name]").textContent = profile.vendor ? profile.vendor.namaVendor : "Vendor";
  root.querySelector("[data-email]").textContent = profile.email || "";
  root.querySelector("[data-logout]").addEventListener("click", () => logout());

  const calendarScreen = root.querySelector('[data-screen="calendar"]');
  const detailScreen = root.querySelector('[data-screen="detail"]');
  const switcher = createSwitcher(calendarScreen, detailScreen);
  root.querySelector("[data-back]").addEventListener("click", () => switcher.showCalendar());

  const calendarBox = root.querySelector("[data-calendar]");
  const dayBox = root.querySelector("[data-day]");
  const profileBox = root.querySelector("[data-profile]");
  const profileToggle = root.querySelector("[data-profile-toggle]");
  const profileClose = root.querySelector("[data-profile-close]");
  const vendorId = profile.vendorId;
  const namaVendor = profile.vendor ? profile.vendor.namaVendor : "";

  if (profile.vendor) {
    renderProfileForm(profileBox, {
      vendorId,
      vendor: profile.vendor,
      email: profile.email,
      onSaved: (data) => Object.assign(profile.vendor, data)
    });
    const details = profileBox.querySelector("details");
    if (details) details.open = true;
  } else {
    profileToggle.hidden = true;
  }

  const profileView = createProfileView(root, {
    screen: root.querySelector('[data-screen="profile"]'),
    suspended: [calendarScreen, detailScreen],
    toggle: profileToggle,
    closeButton: profileClose
  });

  profileToggle.addEventListener("click", () => profileView.toggle());
  profileClose.addEventListener("click", () => profileView.hide());

  let aset;
  try {
    aset = await listAssets(vendorId);
  } catch (err) {
    console.error(err);
    calendarBox.innerHTML = '<p class="error">Gagal memuat data aset.</p>';
    return;
  }

  if (aset.length === 0) {
    calendarBox.innerHTML = '<p class="muted">Belum ada aset terdaftar. Hubungi pemilik WO untuk melengkapi data aset.</p>';
    return;
  }

  let selected = "";

  const calendar = renderCalendar(calendarBox, {
    vendorId,
    aset,
    onSelect(tanggal, details) {
      selected = tanggal;
      renderDayPanel(dayBox, { vendorId, namaVendor, vendor: profile.vendor, aset, tanggal, details, onChanged });
      switcher.showDetail();
    }
  });

  async function onChanged() {
    await calendar.reload();
    const cell = calendarBox.querySelector(`[data-date="${selected}"]`);
    if (cell) cell.click();
  }
}
