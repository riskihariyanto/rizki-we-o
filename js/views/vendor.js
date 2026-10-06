import { logout } from "../auth.js";
import { listAssets } from "../services/assets.js";
import { renderCalendar } from "./vendor/calendar.js";
import { renderDayPanel } from "./vendor/dayPanel.js";
import { renderBlockForm } from "./vendor/blockForm.js";
import { renderProfileForm } from "./vendor/profileform.js";

const TEMPLATE = `
  <section class="stack">
    <header class="row between">
      <div>
        <h1 data-name></h1>
        <p class="muted" data-email></p>
      </div>
      <button class="btn ghost inline" type="button" data-logout>Keluar</button>
    </header>
    <div class="card" data-calendar></div>
    <div data-day></div>
    <div data-block></div>
    <div data-profile></div>
  </section>
`;

export async function render(root, { profile }) {
  root.innerHTML = TEMPLATE;
  root.querySelector("[data-name]").textContent = profile.vendor ? profile.vendor.namaVendor : "Vendor";
  root.querySelector("[data-email]").textContent = profile.email || "";
  root.querySelector("[data-logout]").addEventListener("click", () => logout());

  const calendarBox = root.querySelector("[data-calendar]");
  const dayBox = root.querySelector("[data-day]");
  const blockBox = root.querySelector("[data-block]");
  const profileBox = root.querySelector("[data-profile]");
  const vendorId = profile.vendorId;
  const namaVendor = profile.vendor ? profile.vendor.namaVendor : "";

  if (profile.vendor) {
    renderProfileForm(profileBox, {
      vendorId,
      vendor: profile.vendor,
      email: profile.email,
      onSaved: (data) => Object.assign(profile.vendor, data)
    });
  }

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
      renderBlockForm(blockBox, { vendorId, aset, tanggal, onChanged });
    }
  });

  async function onChanged() {
    await calendar.reload();
    const cell = calendarBox.querySelector(`[data-date="${selected}"]`);
    if (cell) cell.click();
  }
}