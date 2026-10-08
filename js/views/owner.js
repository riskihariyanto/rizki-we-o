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
  <section class="stack owner-shell">
    <header class="owner-hero">
      <div class="owner-hero-copy">
        <span class="eyebrow">OWNER PORTAL</span>
        <div class="row between owner-hero-row">
          <div>
            <h1>Dashboard Owner</h1>
            <p class="muted" data-email></p>
          </div>
          <button class="btn ghost inline" type="button" data-logout>Keluar</button>
        </div>
      </div>
    </header>
    <nav class="owner-tabs" data-tabs></nav>
    <div class="stack owner-content" data-content></div>
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
    buttons.forEach((button, key) => {
      button.classList.toggle("ghost", key !== id);
      button.classList.toggle("is-active", key === id);
    });
    content.replaceChildren();
    tab.mount(content);
  }

  TABS.forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn ghost owner-tab";
    button.textContent = tab.label;
    button.addEventListener("click", () => show(tab.id));
    buttons.set(tab.id, button);
    nav.append(button);
  });

  show(TABS[0].id);
}
