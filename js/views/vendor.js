import { logout } from "../auth.js";
import { listAssets } from "../services/assets.js";
import { renderCalendar } from "./vendor/calendar.js";
import { renderDayPanel } from "./vendor/dayPanel.js";
import { renderProfileForm } from "./vendor/profileform.js";

const SWAP_MS = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;

const TEMPLATE = `
  <section class="screen stack" data-screen="calendar">
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
    <section class="profile-panel" data-panel hidden>
      <h2>Profil &amp; Rekening</h2>
      <div data-profile></div>
    </section>
    <div class="card" data-calendar></div>
  </section>
  <section class="screen screen-detail stack" data-screen="detail" hidden>
    <div class="screen-bar">
      <button class="btn ghost inline" type="button" data-back>&larr; Kembali ke Kalender</button>
    </div>
    <div data-day></div>
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

export async function render(root, { profile }) {
  root.innerHTML = TEMPLATE;
  root.querySelector("[data-name]").textContent = profile.vendor ? profile.vendor.namaVendor : "Vendor";
  root.querySelector("[data-email]").textContent = profile.email || "";
  root.querySelector("[data-logout]").addEventListener("click", () => logout());

  const switcher = createSwitcher(root.querySelector('[data-screen="calendar"]'), root.querySelector('[data-screen="detail"]'));
  root.querySelector("[data-back]").addEventListener("click", () => switcher.showCalendar());

  const calendarBox = root.querySelector("[data-calendar]");
  const dayBox = root.querySelector("[data-day]");
  const profileBox = root.querySelector("[data-profile]");
  const panel = root.querySelector("[data-panel]");
  const profileToggle = root.querySelector("[data-profile-toggle]");
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

  profileToggle.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    profileToggle.setAttribute("aria-expanded", String(open));
    if (open) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

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