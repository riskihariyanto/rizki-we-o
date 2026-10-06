const installButton = document.getElementById("btn-install");
let installEvent = null;

function showInstall(visible) {
  if (installButton) installButton.hidden = !visible;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function registerWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Service worker gagal didaftarkan", err);
    });
  });
}

function bindInstall() {
  if (!installButton || isStandalone()) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installEvent = event;
    showInstall(true);
  });

  installButton.addEventListener("click", async () => {
    if (!installEvent) return;
    const promptEvent = installEvent;
    installEvent = null;
    showInstall(false);
    promptEvent.prompt();
    await promptEvent.userChoice;
  });

  window.addEventListener("appinstalled", () => {
    installEvent = null;
    showInstall(false);
  });
}

registerWorker();
bindInstall();