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
  const card = el("article", "card stack approval-card");
  const identity = el("div", "approval-identity");
  const actions = el("div", "row approval-actions");
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

  identity.append(
    el("p", "eyebrow", "PENDING VENDOR"),
    el("h3", "", vendor.namaVendor)
  );

  const contact = el("p", "muted approval-contact", `${vendor.noWa} · ${vendor.alamat}`);
  const categories = el("p", "approval-categories", categoryText(vendor));

  actions.append(approve, reject);
  card.append(identity, contact, categories, actions);
  return card;
}

export async function renderApprovals(container) {
  container.replaceChildren();

  const intro = el("div", "stack approval-intro");
  intro.append(
    el("p", "eyebrow", "VENDOR MANAGEMENT"),
    el("h2", "", "Persetujuan Vendor"),
    el("p", "muted", "Tinjau pendaftaran vendor baru sebelum masuk ke jaringan aktif.")
  );

  const list = el("div", "stack approval-list");
  const errorBox = el("p", "error");
  container.append(intro, list, errorBox);

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
