import {
  listPackages,
  listClients,
  saveClient,
  createPackage,
  PACKAGE_STATUS
} from "../../services/packages.js";
import { renderPackageBuilder } from "./packageBuilder.js";
import { formatRupiah, formatTanggal } from "../../lib/receipt.js";

const BRAND_KEY = "wo_brand_name";
const DEFAULT_BRAND = "Wedding Organizer";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readBrand() {
  try {
    return localStorage.getItem(BRAND_KEY) || DEFAULT_BRAND;
  } catch (err) {
    return DEFAULT_BRAND;
  }
}

function writeBrand(value) {
  try {
    localStorage.setItem(BRAND_KEY, value.trim() || DEFAULT_BRAND);
  } catch (err) {
    console.error(err);
  }
}

function formTemplate(clients) {
  const options = clients
    .map((c) => `<option value="${c.id}"></option>`)
    .concat('<option value="baru">+ Klien baru</option>')
    .join("");

  return `
    <h3>Paket Baru</h3>
    <label class="field"><span>Nama paket</span><input type="text" name="namaPaket" maxlength="80" required></label>
    <label class="field"><span>Tanggal acara</span><input type="date" name="tanggalAcara" required></label>
    <label class="field"><span>Klien</span><select name="klien">${options}</select></label>
    <div class="stack" data-new-client hidden>
      <label class="field"><span>Nama klien</span><input type="text" name="namaKlien" maxlength="80"></label>
      <label class="field"><span>WhatsApp klien</span><input type="tel" name="noWaKlien" inputmode="tel"></label>
    </div>
    <p class="error" data-error></p>
    <button class="btn" type="submit">Buat Paket</button>
  `;
}

export async function renderPackages(container) {
  container.replaceChildren(el("p", "loading", "Memuat..."));

  let packages;
  let clients;
  try {
    [packages, clients] = await Promise.all([listPackages(), listClients()]);
  } catch (err) {
    console.error(err);
    container.replaceChildren(el("p", "error", "Gagal memuat paket."));
    return;
  }

  const clientNames = new Map(clients.map((c) => [c.id, c.nama]));

  function open(packageId) {
    renderPackageBuilder(container, {
      packageId,
      merek: readBrand(),
      onBack: () => renderPackages(container)
    });
  }

  const brandField = el("label", "field");
  const brandInput = el("input");
  brandInput.type = "text";
  brandInput.maxLength = 60;
  brandInput.value = readBrand();
  brandInput.addEventListener("change", () => writeBrand(brandInput.value));
  brandField.append(el("span", "", "Nama merek WO (untuk penawaran)"), brandInput);

  const form = el("form", "card stack");
  form.noValidate = true;
  form.innerHTML = formTemplate(clients);
  Array.from(form.elements.klien.options).forEach((option, index) => {
    if (clients[index]) option.textContent = `${clients[index].nama} (${clients[index].noWa})`;
  });

  const newClientBox = form.querySelector("[data-new-client]");
  const errorBox = form.querySelector("[data-error]");
  const toggleNewClient = () => {
    newClientBox.hidden = form.elements.klien.value !== "baru";
  };
  form.elements.klien.addEventListener("change", toggleNewClient);
  form.elements.klien.value = clients.length ? clients[0].id : "baru";
  toggleNewClient();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";

    const namaPaket = form.elements.namaPaket.value.trim();
    const tanggalAcara = form.elements.tanggalAcara.value;
    let klienWoId = form.elements.klien.value;

    if (!namaPaket || !tanggalAcara) {
      errorBox.textContent = "Nama paket dan tanggal acara wajib diisi.";
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;

    try {
      if (klienWoId === "baru") {
        const nama = form.elements.namaKlien.value.trim();
        const noWa = form.elements.noWaKlien.value.trim();
        if (!nama || !noWa) {
          errorBox.textContent = "Nama dan WhatsApp klien baru wajib diisi.";
          submit.disabled = false;
          return;
        }
        klienWoId = await saveClient({ nama, noWa });
      }
      const packageId = await createPackage({ namaPaket, tanggalAcara, klienWoId });
      open(packageId);
    } catch (err) {
      console.error(err);
      errorBox.textContent = "Gagal membuat paket.";
      submit.disabled = false;
    }
  });

  const list = el("div", "stack");
  if (packages.length === 0) list.append(el("p", "muted", "Belum ada paket."));

  packages.forEach((pkg) => {
    const card = el("article", "card stack");
    const badgeRow = el("div");
    badgeRow.append(el("span", "badge", PACKAGE_STATUS[pkg.status] || pkg.status));

    const openButton = el("button", "btn ghost inline", "Buka");
    openButton.type = "button";
    openButton.addEventListener("click", () => open(pkg.id));

    card.append(
      el("h3", "", pkg.namaPaket),
      el("p", "muted", `${clientNames.get(pkg.klienWoId) || "Klien tidak ditemukan"} · ${formatTanggal(pkg.tanggalAcara)}`),
      el("p", "", `Harga jual ${formatRupiah(pkg.hargaJual)}`),
      badgeRow,
      openButton
    );
    list.append(card);
  });

  container.replaceChildren(el("h2", "", "Paket Penawaran"), brandField, form, list);
}
