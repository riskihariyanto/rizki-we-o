const VIEWS = {
  login: () => import("./views/login.js"),
  register: () => import("./views/register.js"),
  status: () => import("./views/status.js"),
  vendor: () => import("./views/vendor.js"),
  owner: () => import("./views/owner.js")
};

let root = null;
let session;
let token = 0;

function resolve(profile) {
  if (!profile) return location.hash === "#/daftar" ? "register" : "login";
  if (profile.role === "owner") return "owner";
  if (profile.role === "vendor" && profile.vendor && profile.vendor.status === "aktif") return "vendor";
  return "status";
}

export function navigate(hash) {
  if (location.hash === hash) {
    render();
    return;
  }
  location.hash = hash;
}

async function render() {
  if (session === undefined) return;

  const id = ++token;
  root.innerHTML = '<p class="loading">Memuat...</p>';

  try {
    const view = await VIEWS[resolve(session)]();
    if (id !== token) return;
    root.replaceChildren();
    view.render(root, { profile: session, navigate });
  } catch (err) {
    console.error(err);
    if (id === token) root.innerHTML = '<p class="error">Gagal memuat halaman. Muat ulang aplikasi.</p>';
  }
}

export function initRouter(element) {
  root = element;
  window.addEventListener("hashchange", render);
}

export function route(profile) {
  session = profile;
  render();
}
