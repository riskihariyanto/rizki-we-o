import { listVendorsByStatus, approveVendor, rejectVendor } from "../../services/vendors.js";
import { CATEGORIES } from "../../constants.js";

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function categoryText(vendor) {
  const labels = (vendor.kategori || []).map((id) => CATEGORY_LABEL[id] || id);
  return labels.length ? labels.join(", ") : "Belum memilih aset";
}

function vendorCard(vendor, onDecide) {
  const card = el("article", "card stack");
  const actions = el("div", "row");
  const approve = el("button", "btn inline", "Setujui");
  const reject = el("button", "btn ghost inline", "Tolak");

  approve.type = "button";
  reject.type = "button";

  const decide = (action) => async () => {
    approve.disabled = true;
    reject.disabled = true;
    await onDecide(action, vendor.id);
  };

  approve.addEventListener("click", decide(approveVendor));
  reject.addEventListener("click", decide(rejectVendor));

  actions.append(approve, reject);
  card.append(
    el("h3", "", vendor.namaVendor),
    el("p", "muted", `${vendor.noWa} · ${vendor.alamat}`),
    el("p", "", categoryText(vendor)),
    actions
  );
  return card;
}

export async function renderApprovals(container) {
  container.replaceChildren();

  const list = el("div", "stack");
  const errorBox = el("p", "error");
  container.append(el("h2", "", "Persetujuan Vendor"), list, errorBox);

  async function load() {
    errorBox.textContent = "";
    list.replaceChildren(el("p", "loading", "Memuat..."));

    let vendors;
    try {
      vendors = await listVendorsByStatus("menunggu");
    } catch (err) {
      console.error(err);
      list.replaceChildren();
      errorBox.textContent = "Gagal memuat daftar vendor.";
      return;
    }

    list.replaceChildren();
    if (vendors.length === 0) {
      list.append(el("p", "muted", "Tidak ada pendaftaran baru."));
      return;
    }
    vendors.forEach((vendor) => list.append(vendorCard(vendor, decide)));
  }

  async function decide(action, vendorId) {
    try {
      await action(vendorId);
    } catch (err) {
      console.error(err);
      errorBox.textContent = "Gagal menyimpan keputusan. Coba lagi.";
      return;
    }
    await load();
  }

  await load();
}
