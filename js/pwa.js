const installButton = document.getElementById("btn-install");
const iosDialog = document.getElementById("ios-install-dialog");
let installEvent = null;

function showInstall(visible) {
  if (installButton) installButton.hidden = !visible;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
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

function bindIosGuide() {
  if (!installButton || !iosDialog || isStandalone() || !isIOS()) return false;

  installButton.textContent = "[ 📱 Cara Pasang di iOS ]";
  showInstall(true);

  installButton.addEventListener("click", () => {
    if (typeof iosDialog.showModal === "function") iosDialog.showModal();
  });

  iosDialog.addEventListener("click", (event) => {
    if (event.target === iosDialog) iosDialog.close();
  });

  return true;
}

registerWorker();
if (!bindIosGuide()) bindInstall();
