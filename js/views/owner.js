import { logout } from "../auth.js";
import { renderApprovals } from "./owner/approvals.js";
import { renderChecker } from "./owner/checker.js";
import { renderOverview } from "./owner/overview.js";
import { renderCosts } from "./owner/costs.js";
import { renderPackages } from "./owner/package.js";

const TABS = [
  { id: "overview", label: "Kalender", mount: renderOverview },
  { id: "checker", label: "Cek", mount: (box) => renderChecker(box) },
  { id: "packages", label: "Paket", mount: renderPackages },
  { id: "costs", label: "Harga", mount: renderCosts },
  { id: "approvals", label: "Vendor", mount: renderApprovals }
];

const TEMPLATE = `
  <section class="stack">
    <header class="row between">
      <div>
        <h1>Dashboard Owner</h1>
        <p class="muted" data-email></p>
      </div>
      <button class="btn ghost inline" type="button" data-logout>Keluar</button>
    </header>
    <nav class="row" data-tabs></nav>
    <div class="stack" data-content></div>
  </section>
`;

export function render(root, { profile }) {
  root.innerHTML = TEMPLATE;
  root.querySelector("[data-email]").textContent = profile.email || "";
  root.querySelector("[data-logout]").addEventListener("click", () => logout());

  const nav = root.querySelector("[data-tabs]");
  const content = root.querySelector("[data-content]");
  const buttons = new Map();

  function show(id) {
    const tab = TABS.find((t) => t.id === id);
    buttons.forEach((button, key) => button.classList.toggle("ghost", key !== id));
    content.replaceChildren();
    tab.mount(content);
  }

  TABS.forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn ghost";
    button.textContent = tab.label;
    button.addEventListener("click", () => show(tab.id));
    buttons.set(tab.id, button);
    nav.append(button);
  });

  show(TABS[0].id);
}
