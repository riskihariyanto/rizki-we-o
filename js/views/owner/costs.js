import { loadActiveVendors } from "../../services/availability.js";
import { loadAllCosts, setCost } from "../../services/costs.js";
import { CATEGORIES } from "../../constants.js";
import { attachMoney, parseMoney, setMoney } from "../../lib/money.js";

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function assetForm(vendor, item, price, errorBox) {
  const form = el("form", "stack cost-editor");
  const field = el("label", "field");
  const input = el("input");
  const save = el("button", "btn ghost", "Simpan");

  form.noValidate = true;
  attachMoney(input);
  input.placeholder = "Belum diisi";
  setMoney(input, price);
  save.type = "submit";

  field.append(el("span", "", `${LABEL[item.id] || item.id} · harga modal (Rp)`), input);
  form.append(field, save);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";
    save.disabled = true;

    try {
      await setCost(vendor.id, item.id, parseMoney(input.value));
      save.textContent = "Tersimpan";
    } catch (err) {
      console.error(err);
      errorBox.textContent = "Gagal menyimpan harga modal.";
    } finally {
      save.disabled = false;
    }
  });

  input.addEventListener("input", () => {
    save.textContent = "Simpan";
  });

  return form;
}

export async function renderCosts(container) {
  container.replaceChildren();

  const list = el("div", "stack owner-cost-list");
  const errorBox = el("p", "error");
  const heading = el("div", "section-heading");
  heading.append(
    el("span", "eyebrow", "VENDOR"),
    el("h2", "", "Harga Modal Vendor"),
    el("p", "muted", "Atur harga modal aset untuk perhitungan paket.")
  );

  container.append(heading, errorBox, list);
  list.append(el("p", "loading", "Memuat..."));

  let vendors;
  let costs;
  try {
    [vendors, costs] = await Promise.all([loadActiveVendors(), loadAllCosts()]);
  } catch (err) {
    console.error(err);
    list.replaceChildren();
    errorBox.textContent = "Gagal memuat harga modal.";
    return;
  }

  list.replaceChildren();
  if (vendors.length === 0) {
    list.append(el("p", "muted", "Belum ada vendor aktif."));
    return;
  }

  vendors.forEach((vendor) => {
    const card = el("article", "card stack owner-cost-card");
    const header = el("div", "row between");
    header.append(
      el("div", "stack compact", vendor.namaVendor),
      el("span", "badge", `${vendor.aset.length} aset`)
    );
    card.append(header);

    if (vendor.aset.length === 0) {
      card.append(el("p", "muted", "Vendor belum memiliki aset."));
    }

    const vendorCosts = costs.get(vendor.id) || {};
    vendor.aset.forEach((item) => {
      card.append(assetForm(vendor, item, vendorCosts[item.id], errorBox));
    });

    list.append(card);
  });
}
